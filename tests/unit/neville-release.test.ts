import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { validateSha, versionAtLeast, parseEasBuild, preflightApp, pollBuild, summaryMarkdown, tailErrors, tailLines, finalOutcome, withRetry, validateNevilleDir, resolveNevilleDir, checkSelfContained, NEVILLE_DIRS } from '../../scripts/lib/nevilleRelease.mjs';
// @ts-ignore plain .mjs module
import { makeRedactor } from '../../scripts/lib/ascAppsList.mjs';

const eas = (o: Record<string, unknown> = {}) => JSON.stringify([{
  status: 'FINISHED', platform: 'IOS', appVersion: '1.1.0', appBuildVersion: '159',
  artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/abc_123.ipa' }, ...o }]);

test('sha must be 40 lowercase hex chars', () => {
  assert.equal(validateSha('a'.repeat(40)), 'a'.repeat(40));
  for (const bad of ['main', 'A'.repeat(40), 'a'.repeat(39), 'a'.repeat(41), `${'a'.repeat(39)};`, '', undefined]) {
    assert.throws(() => validateSha(bad as string), /40-character/);
  }
});

test('versionAtLeast compares numerically', () => {
  assert.ok(versionAtLeast('1.1.0', [1, 1, 0]));
  assert.ok(versionAtLeast('1.10', [1, 2, 0]));
  assert.ok(versionAtLeast('2', [1, 1, 0]));
  assert.ok(!versionAtLeast('1.0.9', [1, 1, 0]));
});

test('parseEasBuild accepts the expected build 159 / 1.1.0', () => {
  assert.deepEqual(parseEasBuild(eas()), { version: '1.1.0', build: '159', ipaUrl: 'https://expo.dev/artifacts/eas/abc_123.ipa' });
});

test('parseEasBuild refuses anything that could touch the live version or a foreign host', () => {
  assert.throws(() => parseEasBuild(eas({ appVersion: '1.0.0' })), /at least 1\.1\.0/);
  assert.throws(() => parseEasBuild(eas({ appBuildVersion: '157' })), /at least 158/);
  assert.throws(() => parseEasBuild(eas({ appBuildVersion: '159; rm' })), /numeric build/);
  assert.throws(() => parseEasBuild(eas({ artifacts: { buildUrl: 'https://evil.example/x.ipa' } })), /artifact URL/);
  assert.throws(() => parseEasBuild(eas({ status: 'ERRORED' })), /not FINISHED/);
  assert.throws(() => parseEasBuild(eas({ platform: 'ANDROID' })), /not an iOS/);
  assert.throws(() => parseEasBuild('not json'), /JSON/);
});

test('preflight passes only for the Neville bundle id and uses GET paths', async () => {
  const calls: string[] = [];
  const ok = async (p: string) => { calls.push(p); return { status: 200, body: { data: { attributes: { bundleId: 'pckg.neville' } } } }; };
  await preflightApp(ok);
  assert.match(calls[0], /^\/v1\/apps\/6740147041\?/);
  const wrong = async () => ({ status: 200, body: { data: { attributes: { bundleId: 'com.timfong888.wouldyourather' } } } });
  await assert.rejects(preflightApp(wrong), /does not belong to the Neville bundle id/);
  await assert.rejects(preflightApp(async () => ({ status: 401, body: {} })), /HTTP 401/);
});

test('pollBuild stops at VALID and reports only state', async () => {
  const states = ['PROCESSING', 'PROCESSING', 'VALID'];
  let n = 0; const queries: string[] = [];
  const get = async (p: string) => { queries.push(p); return { status: 200, body: { data: [{ attributes: { processingState: states[n++] } }] } }; };
  const r = await pollBuild(get, { build: '159', version: '1.1.0', sleep: async () => {}, intervalMs: 0 });
  assert.deepEqual(r, { state: 'VALID', polls: 3 });
  assert.match(queries[0], /filter\[app\]=6740147041&filter\[version\]=159&filter\[preReleaseVersion\.version\]=1\.1\.0/);
});

test('pollBuild gives up as still-processing or not-found without throwing', async () => {
  const proc = await pollBuild(async () => ({ status: 200, body: { data: [{ attributes: { processingState: 'PROCESSING' } }] } }),
    { build: '159', version: '1.1.0', sleep: async () => {}, maxPolls: 2 });
  assert.deepEqual(proc, { state: 'PROCESSING', polls: 2 });
  const none = await pollBuild(async () => ({ status: 200, body: { data: [] } }), { build: '159', version: '1.1.0', sleep: async () => {}, maxPolls: 2 });
  assert.equal(none.state, 'NOT_FOUND');
  const bad = await pollBuild(async () => ({ status: 500, body: {} }), { build: '159', version: '1.1.0', sleep: async () => {}, maxPolls: 1 });
  assert.equal(bad.state, 'HTTP_500');
});

test('pollBuild keeps the last real state across a transient HTTP error and stops at once on 401/403', async () => {
  const seq = [{ status: 200, body: { data: [{ attributes: { processingState: 'PROCESSING' } }] } }, { status: 500, body: {} }];
  let n = 0;
  const kept = await pollBuild(async () => seq[n++], { build: '159', version: '1.1.0', sleep: async () => {}, maxPolls: 2 });
  assert.equal(kept.state, 'PROCESSING');
  let calls = 0;
  const auth = await pollBuild(async () => { calls++; return { status: 403, body: {} }; }, { build: '159', version: '1.1.0', sleep: async () => {}, maxPolls: 60 });
  assert.deepEqual(auth, { state: 'HTTP_403', polls: 1 });
  assert.equal(calls, 1);
});

test('summary holds only build number and state', () => {
  const md = summaryMarkdown('159', 'VALID');
  assert.match(md, /\| 159 \| VALID \|/);
});

test('tailErrors redacts secrets and truncates', () => {
  const key = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49\n-----END PRIVATE KEY-----';
  const redact = makeRedactor(['KEYID12345', 'ISSUER-UUID-1', key]);
  const out = tailErrors(`ok line\nerror: auth failed for KEYID12345 issuer ISSUER-UUID-1\nMIGTAgEAMBMGByqGSM49 error ${'x'.repeat(500)}`, redact);
  assert.ok(!out.includes('KEYID12345') && !out.includes('ISSUER-UUID-1'));
  assert.ok(out.split('\n').every((l: string) => l.startsWith('| ') && l.length <= 302));
  assert.ok(!out.includes('ok line'));
});

test('tailLines keeps the last 60 lines, redacts secrets, truncates, prefixes', () => {
  const redact = makeRedactor(['KEYID12345', 'EXPOTOKEN-abc']);
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i} KEYID12345 ${'x'.repeat(i === 99 ? 500 : 1)}`);
  const out = tailLines(lines.join('\n') + '\nEXPOTOKEN-abc', redact).split('\n');
  assert.equal(out.length, 60);
  assert.ok(!out.join('\n').includes('KEYID12345') && !out.join('\n').includes('EXPOTOKEN-abc'));
  assert.ok(out.every((l: string) => l.startsWith('| ') && l.length <= 302));
  assert.equal(out[out.length - 1], '| ***');
});

test('tailLines redacts a multi-line PEM key that spans lines', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEG\nCCqGSM49AwEHBG0wawIBAQQg\n-----END PRIVATE KEY-----';
  const redact = makeRedactor([pem]);
  const out = tailLines(`before\nkey dump:\n${pem}\nafter`, redact);
  for (const frag of ['BEGIN PRIVATE KEY', 'MIGTAgEAMBMGByqGSM49AgEG', 'CCqGSM49AwEHBG0wawIBAQQg', 'END PRIVATE KEY']) {
    assert.ok(!out.includes(frag), frag);
  }
  assert.match(out, /before/);
  assert.match(out, /after/);
});

test('tailLines replaces URLs (signed tokens) and neutralises workflow commands', () => {
  const redact = makeRedactor(['KEYID12345']);
  const out = tailLines('fetch https://x.example/a?sig=SECRETSIG&b=1 failed\n::stop-commands::abc\n::add-mask::oops', redact);
  assert.ok(!out.includes('SECRETSIG') && !out.includes('x.example'));
  assert.match(out, /<url>/);
  // The runner trims leading whitespace before looking for `::`, so test it the way the runner does.
  const asRunner = (t: string) => t.split(/\r\n|\r|\n/).map((l) => l.trimStart());
  for (const l of asRunner(out)) assert.ok(!l.startsWith('::'), l);
  assert.ok(out.split('\n').every((l: string) => l.startsWith('| ')));
  // A bare \r (CLI progress output) starts a new line for the runner: it must not smuggle a command either.
  const cr = tailLines('progress 10%\r::error title=x::injected\nok\r\n::stop-commands::z', redact);
  for (const l of asRunner(cr)) assert.ok(!l.startsWith('::'), l);
  assert.ok(!cr.includes('\r'));
  const crErr = tailErrors('error: a\r::add-mask::q failed', redact);
  for (const l of asRunner(crErr)) assert.ok(!l.startsWith('::'), l);
  // Even a whitespace-led command line is neutralised.
  const spaced = tailLines('   ::add-mask::x\n\t::stop-commands::y', redact);
  for (const l of asRunner(spaced)) assert.ok(!l.startsWith('::'), l);
});

test('finalOutcome: only VALID and PROCESSING are green', () => {
  assert.equal(finalOutcome('VALID').exitCode, 0);
  assert.equal(finalOutcome('PROCESSING').exitCode, 0);
  for (const s of ['FAILED', 'INVALID', 'NOT_FOUND', 'HTTP_401', 'HTTP_500', '', undefined]) {
    assert.equal(finalOutcome(s as string).exitCode, 1, String(s));
  }
});

// Static guard on the workflow file: the security rules cannot silently regress.
const wfRaw = readFileSync(new URL('../../.github/workflows/neville-ios-testflight.yml', import.meta.url), 'utf8');
const wf = wfRaw.split('\n').filter((l: string) => !l.trimStart().startsWith('#')).join('\n');

test('workflow: dispatch only, read-only token, guarded job', () => {
  assert.match(wf, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(wf, /pull_request|push:|schedule:|workflow_run/);
  assert.match(wf, /permissions:\n  contents: read/);
  assert.match(wf, /github\.actor == 'timfong888'/);
  assert.match(wf, /github\.triggering_actor == 'timfong888'/);
  assert.match(wf, /github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(wf, /upload-artifact|GITHUB_ENV|GITHUB_OUTPUT/);
});

test('workflow: hardcoded neville repo and ref, one sha input checked before secrets', () => {
  assert.equal((wf.match(/^      [a-z_]+:\n        description:/gm) || []).length, 2);
  assert.match(wf, /NEVILLE_REPO: timfong888\/neville/);
  assert.match(wf, /git clone --no-tags "https:\/\/github\.com\/\$\{NEVILLE_REPO\}\.git"/);
  assert.match(wf, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(wf, /merge-base --is-ancestor/);
  assert.ok(wf.indexOf('merge-base --is-ancestor') < wf.indexOf('secrets.'));
});

test('workflow: neville is checked out outside the workspace', () => {
  assert.match(wf, /NEVILLE_DEST: \$\{\{ runner\.temp \}\}\/neville/);
  assert.match(wf, /NEVILLE_ROOT: \$\{\{ runner\.temp \}\}\/neville\n\s+NEVILLE_SUBDIR: \$\{\{ inputs\.neville_dir \}\}/);
  assert.doesNotMatch(wf, /NEVILLE_DIR:/);
  assert.doesNotMatch(wf, /path: neville/);
  assert.doesNotMatch(wf, /working-directory: neville/);
});

test('workflow: every action pinned to a full sha, secrets in exactly one step', () => {
  const uses = [...wf.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
  const secretLines = wf.split('\n').filter((l: string) => l.includes('secrets.'));
  assert.equal(secretLines.length, 4);
  const first = wf.indexOf('secrets.'), last = wf.lastIndexOf('secrets.');
  assert.ok(!wf.slice(first, last).includes('- name:'), 'secrets span more than one step');
});

test('withRetry retries a throwing call 3 times with doubling backoff, then rethrows', async () => {
  const waits: number[] = [];
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new Error('fetch failed'); }, { sleep: async (ms: number) => { waits.push(ms); }, baseMs: 10 }), /fetch failed/);
  assert.equal(n, 3);
  assert.deepEqual(waits, [10, 20]);
  let m = 0;
  const ok = await withRetry(async () => { if (++m < 3) throw new Error('x'); return 'ok'; }, { sleep: async () => {}, baseMs: 0 });
  assert.equal(ok, 'ok');
});

test('pollBuild survives a throwing GET: retries, recovers, or reports FETCH_ERROR without throwing', async () => {
  let n = 0;
  const recovered = await pollBuild(async () => { if (++n < 3) throw new Error('fetch failed'); return { status: 200, body: { data: [{ attributes: { processingState: 'VALID' } }] } }; },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 1, retryBaseMs: 0 });
  assert.equal(recovered.state, 'VALID');
  let calls = 0;
  const dead = await pollBuild(async () => { calls++; throw new Error('fetch failed'); }, { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 2, retryBaseMs: 0 });
  assert.equal(dead.state, 'FETCH_ERROR');
  assert.equal(calls, 6);
});

test('finalOutcome: a network error is only a warning once Apple reported the upload COMPLETE', () => {
  assert.deepEqual(finalOutcome('FETCH_ERROR', { uploadComplete: true }), { exitCode: 0, kind: 'unverified' });
  assert.equal(finalOutcome('FETCH_ERROR').exitCode, 1);
  for (const s of ['FAILED', 'INVALID', 'NOT_FOUND', 'HTTP_403', 'HTTP_500']) assert.equal(finalOutcome(s, { uploadComplete: true }).exitCode, 1, s);
});

test('summaryMarkdown names version, build and that Apple processed it', () => {
  const md = summaryMarkdown('164', 'VALID', '1.1.0');
  assert.match(md, /Version 1\.1\.0, build 164: processed by Apple/);
  assert.match(summaryMarkdown('164', 'PROCESSING'), /Build 164: PROCESSING/);
});

test('pollBuild: a network error never hides an earlier HTTP error answer', async () => {
  let n = 0;
  const r = await pollBuild(async () => { if (++n === 1) return { status: 503, body: {} }; throw new Error('fetch failed'); },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 2, retryBaseMs: 0 });
  assert.equal(r.state, 'HTTP_503');
  assert.equal(finalOutcome(r.state, { uploadComplete: true }).exitCode, 1);
  // network error first, then HTTP error: HTTP wins as well
  let m = 0;
  const r2 = await pollBuild(async () => { if (++m <= 3) throw new Error('fetch failed'); return { status: 500, body: {} }; },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 2, retryBaseMs: 0 });
  assert.equal(r2.state, 'HTTP_500');
});

test('pollBuild gives up after 3 consecutive network-failed polls instead of polling for the whole budget', async () => {
  let calls = 0;
  const r = await pollBuild(async () => { calls++; throw new Error('fetch failed'); }, { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 60, retryBaseMs: 0 });
  assert.equal(r.state, 'FETCH_ERROR');
  assert.equal(r.polls, 3);
  assert.equal(calls, 9);
  // a good answer in between resets the streak
  let n = 0;
  const ok = await pollBuild(async () => { n++; if (n <= 6) throw new Error('x'); if (n === 7) return { status: 200, body: { data: [{ attributes: { processingState: 'PROCESSING' } }] } }; throw new Error('x'); },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 60, retryBaseMs: 0 });
  assert.equal(ok.state, 'PROCESSING');
});

test('pollBuild: an early empty 200 (NOT_FOUND) followed by an outage reports FETCH_ERROR, not NOT_FOUND', async () => {
  let n = 0;
  const r = await pollBuild(async () => { if (++n === 1) return { status: 200, body: { data: [] } }; throw new Error('fetch failed'); },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 60, retryBaseMs: 0 });
  assert.equal(r.state, 'FETCH_ERROR');
  assert.equal(finalOutcome(r.state, { uploadComplete: true }).exitCode, 0);
  // a real earlier PROCESSING answer is still kept
  let m = 0;
  const p = await pollBuild(async () => { if (++m === 1) return { status: 200, body: { data: [{ attributes: { processingState: 'PROCESSING' } }] } }; throw new Error('x'); },
    { build: '164', version: '1.1.0', sleep: async () => {}, maxPolls: 60, retryBaseMs: 0 });
  assert.equal(p.state, 'PROCESSING');
});

// ---- neville_dir: allowlist, check step, no leakage ----
import { mkdtempSync, mkdirSync, writeFileSync as wfs } from 'node:fs';
import * as nodeFs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('neville_dir allowlist accepts exactly ios-shell and native, rejects anything else', () => {
  assert.deepEqual([...NEVILLE_DIRS], ['ios-shell', 'native']);
  assert.equal(validateNevilleDir('native'), 'native');
  assert.equal(resolveNevilleDir('/r/neville', 'ios-shell'), '/r/neville/ios-shell');
  for (const bad of ['', 'Native', 'native/', '../native', 'native/..', '/etc', 'ios-shell/../x', 'native ', '__proto__', 'constructor', undefined, null, 1]) {
    assert.throws(() => validateNevilleDir(bad as string), /neville_dir must be one of/, String(bad));
    assert.throws(() => resolveNevilleDir('/r/neville', bad as string), /neville_dir/);
  }
  assert.throws(() => resolveNevilleDir('', 'native'), /NEVILLE_ROOT/);
  assert.ok(!/\.\.\/evil/.test((() => { try { validateNevilleDir('../evil'); } catch (e) { return (e as Error).message; } return ''; })()), 'error must not echo the input');
});

test('workflow: neville_dir is a choice of exactly two options, default ios-shell, never interpolated into a script', () => {
  assert.match(wf, /neville_dir:\n        description: [^\n]+\n        type: choice\n        options:\n          - ios-shell\n          - native\n        default: ios-shell/);
  assert.match(wf, /case "\$NEVILLE_SUBDIR" in ios-shell\|native\) ;;/);
  assert.ok(wf.indexOf('case "$NEVILLE_SUBDIR"') < wf.indexOf('git clone'));
  // inputs.* appears only as the value of an env: entry, so it never lands inside a run: script.
  for (const l of wf.split('\n').filter((x: string) => x.includes('inputs.'))) assert.match(l, /^\s+[A-Z_]+: \$\{\{ inputs\.[a-z_]+ \}\}$/, l);
  assert.doesNotMatch(wf, /working-directory:.*inputs\./);
  assert.doesNotMatch(wf, /ios-shell\n.*working-directory|neville\/ios-shell/);
});

test('workflow: no secret reaches the allowlist, clone, check or install steps', () => {
  const steps = wf.split(/\n      - /);
  for (const st of steps) {
    if (st.includes('secrets.')) {
      assert.match(st, /Build on EAS/);
      assert.match(st, /NEVILLE_SUBDIR: \$\{\{ inputs\.neville_dir \}\}/);
    }
  }
  assert.ok(wf.indexOf('neville-check.mjs') < wf.indexOf('secrets.'));
  assert.ok(wf.indexOf('npm ci --ignore-scripts') < wf.indexOf('secrets.'));
  assert.match(wf, /EAS_PROFILE: production/);
});

const fixture = (files: Record<string, string>, sub = 'native') => {
  const root = mkdtempSync(join(tmpdir(), 'nev-'));
  const dir = join(root, sub); mkdirSync(dir, { recursive: true });
  for (const [f, c] of Object.entries(files)) wfs(join(dir, f), c);
  return { root, dir };
};
const goodNative = {
  'package.json': JSON.stringify({ name: 'n', dependencies: { expo: '~58.0.0' } }),
  'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: 'pckg.neville' } } }),
  'eas.json': JSON.stringify({ cli: { appVersionSource: 'remote' }, build: { production: {} } }),
};

test('check: a self-contained native dir passes and reports profile, versioning, metro and workspaces', () => {
  const { dir } = fixture(goodNative);
  const r = checkSelfContained(dir, 'native', { fs: nodeFs });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  const out = r.lines.join('\n');
  assert.match(out, /directory: native/);
  assert.match(out, /metro\.config\.js: absent/);
  assert.match(out, /no workspaces in native\/package\.json/);
  assert.match(out, /eas profile "production": present/);
  assert.match(out, /appVersionSource: remote/);
  assert.match(out, /bundle id: pckg\.neville/);
});

test('check: native fails without its own package.json, app.json or eas.json, and on parent or workspace dependencies', () => {
  for (const f of Object.keys(goodNative)) {
    const { [f as keyof typeof goodNative]: _, ...rest } = goodNative;
    const { dir } = fixture(rest);
    assert.ok(checkSelfContained(dir, 'native', { fs: nodeFs }).errors.some((e: string) => e.includes(`native/${f} is missing`)), f);
  }
  for (const v of ['file:../shared', 'link:../shared', 'workspace:*']) {
    const { dir } = fixture({ ...goodNative, 'package.json': JSON.stringify({ dependencies: { shared: v } }) });
    assert.ok(checkSelfContained(dir, 'native', { fs: nodeFs }).errors.some((e: string) => /parent path or workspace/.test(e)), v);
  }
  const wrongId = fixture({ ...goodNative, 'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: 'com.other' } } }) });
  assert.ok(checkSelfContained(wrongId.dir, 'native', { fs: nodeFs }).errors.some((e: string) => /bundleIdentifier/.test(e)));
  const noProfile = fixture({ ...goodNative, 'eas.json': JSON.stringify({ build: { preview: {} } }) });
  assert.ok(checkSelfContained(noProfile.dir, 'native', { fs: nodeFs }).errors.some((e: string) => /no build profile "production"/.test(e)));
});

test('check: ios-shell keeps its old requirements (package.json, eas.json only)', () => {
  const { dir } = fixture({ 'package.json': '{}', 'eas.json': JSON.stringify({ build: { production: {} } }) }, 'ios-shell');
  assert.deepEqual(checkSelfContained(dir, 'ios-shell', { fs: nodeFs }).errors, []);
  assert.throws(() => checkSelfContained(dir, '../x', { fs: nodeFs }), /neville_dir/);
});

test('check: metro.config.js parent or workspaces references are warned with line numbers only, never content', () => {
  const metro = "const a = 1;\nconst root = path.resolve(__dirname, '../..');\nconst workspaceRoot = x; // ::stop-commands::SECRETISH\n";
  const { dir } = fixture({ ...goodNative, 'metro.config.js': metro });
  const r = checkSelfContained(dir, 'native', { fs: nodeFs });
  assert.ok(r.warnings.some((w: string) => /references a parent directory \(line 2\)/.test(w)));
  assert.ok(r.warnings.some((w: string) => /workspaces \(line 3\)/.test(w)));
  const all = [...r.lines, ...r.warnings, ...r.errors].join('\n');
  assert.ok(!all.includes('SECRETISH') && !all.includes('stop-commands'));
  assert.equal(r.errors.length, 0);
});

test('check script: runs end to end, rejects a bad dir, and prints no secret env values', () => {
  const { root } = fixture(goodNative);
  const secrets = { EXPO_TOKEN: 'tok-EXPO-123456', ASC_KEY_ID: 'KEYID12345', ASC_ISSUER_ID: 'issuer-uuid-9', ASC_PRIVATE_KEY: 'PEM-BODY-xyz', APPLE_TEAM_ID: 'VJKU43W3C2' };
  const run = (sub: string) => spawnSync('node', [new URL('../../scripts/neville-check.mjs', import.meta.url).pathname], { env: { PATH: process.env.PATH, NEVILLE_ROOT: root, NEVILLE_SUBDIR: sub, RUNNER_TEMP: tmpdir(), ...secrets }, encoding: 'utf8' });
  const ok = run('native');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /directory: native/);
  for (const v of Object.values(secrets)) assert.ok(!(ok.stdout + ok.stderr).includes(v));
  for (const bad of ['../native', 'ios-shell/..', '/etc', 'other']) {
    const r = run(bad);
    assert.equal(r.status, 2, bad);
    assert.ok(!(r.stdout + r.stderr).includes(bad), 'must not echo the input');
    assert.match(r.stderr, /neville_dir must be one of: ios-shell, native/);
  }
  assert.equal(run('ios-shell').status, 1); // fixture has no ios-shell dir contents: required files missing
});

test('summaryMarkdown names the directory and build number, and refuses a non-allowlisted dir', () => {
  const md = summaryMarkdown('165', 'VALID', '2.0.0', 'native');
  assert.match(md, /Directory: `native`/);
  assert.match(md, /Version 2\.0\.0, build 165: processed by Apple/);
  assert.match(md, /\| 165 \| VALID \|/);
  assert.throws(() => summaryMarkdown('165', 'VALID', '2.0.0', '../x'), /neville_dir/);
  assert.ok(!summaryMarkdown('165', 'VALID', '1.1.0').includes('Directory:'));
});
