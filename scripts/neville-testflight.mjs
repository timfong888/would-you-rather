#!/usr/bin/env node
// Build the Neville iOS app on EAS and send it to TestFlight. Used by .github/workflows/neville-ios-testflight.yml.
// Env (all GitHub Actions secrets, only this step sees them): EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY,
//   plus NEVILLE_DIR (checkout of timfong888/neville at a merged sha), EAS_PROFILE, APPLE_TEAM_ID, GITHUB_STEP_SUMMARY.
// Flow: preflight app (GET) -> eas build (EAS creates the missing provisioning profile via the ASC key)
//   -> existing scripts/asc-upload.mjs -> poll builds (GET) -> job summary with build number and state only.
// Never prints: the key, key id, issuer id, JWT, team id, or any Apple data other than build number and state.
import { createPrivateKey, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { makeRedactor } from './lib/ascAppsList.mjs';
import { NEVILLE_APP_ID, finalOutcome, parseEasBuild, preflightApp, pollBuild, summaryMarkdown, tailErrors } from './lib/nevilleRelease.mjs';

const env = process.env;
const { EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID } = env;
const redact = makeRedactor([EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID]);
const say = (m) => console.log(redact(m));
const die = (m, code = 1) => { console.error(redact(m)); cleanup(); process.exit(code); };

let tmp;
function cleanup() { if (tmp) { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } tmp = undefined; } }

for (const [k, v] of Object.entries({ EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID })) {
  if (!v) die(`Missing ${k}. ${k === 'EXPO_TOKEN' ? 'Add an Expo access token (account that owns the EAS project) as the EXPO_TOKEN Actions secret.' : 'Set it as a GitHub Actions secret.'}`, 2);
}
if (!/^[A-Z0-9]{10}$/.test(APPLE_TEAM_ID)) die('APPLE_TEAM_ID is not a 10-character team id.', 2);
const profile = env.EAS_PROFILE || 'production';
if (!/^[A-Za-z0-9_-]{1,40}$/.test(profile)) die('EAS_PROFILE has unexpected characters.', 2);
const nevilleDir = resolve(env.NEVILLE_DIR || 'neville');

// Mask everything sensitive in the public log, including each line of the key (masks are per-line).
for (const v of [ASC_KEY_ID, ASC_ISSUER_ID, APPLE_TEAM_ID, EXPO_TOKEN, ...ASC_PRIVATE_KEY.replace(/\\n/g, '\n').split(/\r?\n/)]) {
  if (v && v.trim().length >= 4) console.log(`::add-mask::${v.trim()}`);
}

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }))}.` +
    b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  return `${input}.${b64u(sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
// GET only. There is deliberately no method parameter.
async function get(path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt()}` } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  return { status: res.status, body };
}

try {
  // 1. Is this really the Neville app? Throws without printing Apple data.
  await preflightApp(get);
  say('preflight ok: ASC app matches the Neville bundle id');

  // 2. Key file: temp dir outside the checkout, mode 600, removed in finally.
  tmp = mkdtempSync(join(tmpdir(), 'asc-'), { mode: 0o700 });
  const keyPath = join(tmp, 'AuthKey.p8');
  writeFileSync(keyPath, ASC_PRIVATE_KEY.replace(/\\n/g, '\n'), { mode: 0o600 });

  // 3. EAS build. The child gets an explicit env allowlist; output is captured, never streamed.
  const childEnv = {
    PATH: env.PATH, HOME: env.HOME, CI: '1',
    EXPO_TOKEN, EXPO_APPLE_TEAM_ID: APPLE_TEAM_ID, EXPO_APPLE_TEAM_TYPE: 'COMPANY_OR_ORGANIZATION',
    EXPO_ASC_API_KEY_PATH: keyPath, EXPO_ASC_KEY_ID: ASC_KEY_ID, EXPO_ASC_ISSUER_ID: ASC_ISSUER_ID,
    EXPO_NO_TELEMETRY: '1',
  };
  say(`eas build: starting (profile ${profile}); output is captured, waiting for EAS`);
  const eas = spawnSync('npx', ['--yes', 'eas-cli@27.11.0', 'build', '--platform', 'ios', '--profile', profile,
    '--non-interactive', '--wait', '--json'], { cwd: nevilleDir, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (eas.status !== 0) {
    const tail = tailErrors(`${eas.stderr}\n${eas.stdout}`, redact);
    die(`eas build failed (exit ${eas.status}).${tail ? `\n${tail}` : ''}`);
  }
  const { version, build, ipaUrl } = parseEasBuild(eas.stdout);
  say(`eas build finished: version ${version}, build ${build}`);

  // 4. Upload with the existing, unchanged uploader (its output is already secret-safe); stream through the redactor.
  const up = spawnSync('node', [join(import.meta.dirname, 'asc-upload.mjs'), '--app', NEVILLE_APP_ID,
    '--ipa-url', ipaUrl, '--version', version, '--build', build],
  { env: { PATH: env.PATH, HOME: env.HOME, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const lines = `${up.stdout}\n${up.stderr}`.split(/\r?\n/).filter((l) => /^(state:|upload committed|uploaded |commit |Upload |IPA downloaded)/.test(l));
  if (lines.length) say(lines.join('\n'));
  if (up.status !== 0) die(`upload step failed (exit ${up.status}).\n${tailErrors(`${up.stderr}\n${up.stdout}`, redact)}`);

  // 5. Poll the builds endpoint (GET). Only build number and processing state are reported.
  const { state } = await pollBuild(get, { build, version, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
  say(`build ${build}: ${state}`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, summaryMarkdown(build, state));
  const outcome = finalOutcome(state);
  if (outcome.kind === 'still-processing') say(`::notice title=Still processing::Build ${build} is ${state} on Apple's side; this is not an error. Re-check with Apple ops "builds".`);
  else if (outcome.exitCode !== 0) die(`Build ${build} did not reach a usable state (${state}). Check TestFlight / run Apple ops "builds".`);
} catch (e) {
  die(`neville release failed: ${e.message}`);
} finally {
  cleanup();
}
