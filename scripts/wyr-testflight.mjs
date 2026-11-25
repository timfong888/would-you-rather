#!/usr/bin/env node
// Build the Would You Rather iOS app (this repo, at a merged sha) on EAS and send it to TestFlight.
// Used by .github/workflows/wyr-ios-testflight.yml. Modelled on scripts/neville-testflight.mjs.
// Env (all GitHub Actions secrets, only this step sees them): EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY,
//   plus WYR_ROOT (checkout of this repo at a sha that is an ancestor of main), EAS_PROFILE (must be preview), APPLE_TEAM_ID, GITHUB_STEP_SUMMARY.
// Flow: preflight app (GET) -> eas build (EAS creates the missing provisioning profile via the ASC key)
//   -> existing scripts/asc-upload.mjs -> poll builds (GET) -> job summary with build number and state only.
// Never prints: the key, key id, issuer id, JWT, team id or Expo token (all masked and redacted). On the success path the only
// Apple data printed is build number and processing state. If `eas build` FAILS, the last 60 lines of its output are printed
// (secrets redacted); EAS can include non-secret Apple-side names there (team, certificate or profile labels). Accepted on purpose,
// so a failed run is debuggable from the public log.
import { createPrivateKey, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { appendFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeRedactor } from './lib/ascAppsList.mjs';
import { finalOutcome, preflightApp, pollBuild, tailErrors, tailLines } from './lib/nevilleRelease.mjs';
import { WYR_APP_ID, WYR_BUNDLE_ID, WYR_PROFILE, parseWyrEasBuild, wyrSummaryMarkdown } from './lib/wyrRelease.mjs';

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
const profile = env.EAS_PROFILE || WYR_PROFILE;
if (profile !== WYR_PROFILE) die(`EAS_PROFILE must be ${WYR_PROFILE}; production builds need Tim's explicit go.`, 2);
const wyrDir = env.WYR_ROOT; // the checkout of this repo at the requested sha (outside the workflow workspace)
if (!wyrDir || !wyrDir.startsWith('/')) die('WYR_ROOT must be an absolute path.', 2);
{ // a real directory, not a symlink, with the app config and the EAS config in it, before anything is spawned
  let ok = false;
  try { ok = fs.lstatSync(wyrDir).isDirectory() && fs.existsSync(join(wyrDir, 'eas.json')) && fs.existsSync(join(wyrDir, 'app.json')); } catch { /* not there */ }
  if (!ok) die('WYR_ROOT is not a checkout with app.json and eas.json.', 2);
}

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
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt()}` }, signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = {}; }
  return { status: res.status, body };
}

try {
  // 1. Is this really the Would You Rather app? Throws without printing Apple data.
  await preflightApp(get, { appId: WYR_APP_ID, bundleId: WYR_BUNDLE_ID });
  say('preflight ok: ASC app matches the Would You Rather bundle id');

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
    '--non-interactive', '--wait', '--json'], { cwd: wyrDir, env: childEnv, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (eas.status !== 0) {
    // stderr only: stdout holds the --json result, never what went wrong.
    const tail = tailLines(eas.stderr, redact, 60) || '| (no stderr output)';
    die(`eas build failed (exit ${eas.status}). Last lines of EAS output (secrets redacted):\n${tail}`);
  }
  const { version, build, ipaUrl } = parseWyrEasBuild(eas.stdout);
  say(`eas build finished: version ${version}, build ${build}`);

  // 4. Upload with the existing, unchanged uploader (its output is already secret-safe); stream through the redactor.
  const up = spawnSync('node', [join(import.meta.dirname, 'asc-upload.mjs'), '--app', WYR_APP_ID,
    '--ipa-url', ipaUrl, '--version', version, '--build', build],
  { env: { PATH: env.PATH, HOME: env.HOME, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const lines = `${up.stdout}\n${up.stderr}`.split(/\r?\n/).filter((l) => /^(state:|upload committed|uploaded |commit |Upload |IPA downloaded)/.test(l));
  if (lines.length) say(lines.join('\n'));
  if (up.status !== 0) die(`upload step failed (exit ${up.status}).\n${tailErrors(`${up.stderr}\n${up.stdout}`, redact)}`);

  // 5. Poll the builds endpoint (GET). Only build number and processing state are reported.
  const uploadComplete = lines.some((l) => l.trim() === 'state: COMPLETE');
  const { state } = await pollBuild(get, { appId: WYR_APP_ID, build, version, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });
  say(`build ${build}: ${state}`);
  const outcome = finalOutcome(state, { uploadComplete });
  const shown = outcome.kind === 'unverified' ? 'UPLOADED (Apple reported the upload COMPLETE; status check unreachable)' : state;
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, wyrSummaryMarkdown(build, shown, version));
  if (outcome.kind === 'valid') say(`Would You Rather ${version} build ${build}: processed by Apple (VALID), ready in TestFlight.`);
  else if (outcome.kind === 'unverified') say(`::warning title=Apple status check failed::Would You Rather ${version} build ${build} was uploaded and Apple reported the upload COMPLETE, but the processing-state check hit a network error after 3 attempts per poll. The build was delivered; check TestFlight.`);
  else if (outcome.kind === 'still-processing') say(`::notice title=Still processing::Build ${build} is ${state} on Apple's side; this is not an error. Re-check with Apple ops "builds".`);
  else if (outcome.exitCode !== 0) die(`Build ${build} did not reach a usable state (${state}). Check TestFlight / run Apple ops "builds".`);
} catch (e) {
  die(`wyr release failed: ${e.message}`);
} finally {
  cleanup();
}
