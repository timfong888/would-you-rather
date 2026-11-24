import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { validateSha, versionAtLeast, parseEasBuild, preflightApp, pollBuild, summaryMarkdown, tailErrors, tailLines, finalOutcome, withRetry } from '../../scripts/lib/nevilleRelease.mjs';
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
  assert.equal((wf.match(/^      [a-z_]+:\n        description:/gm) || []).length, 1);
  assert.match(wf, /NEVILLE_REPO: timfong888\/neville/);
  assert.match(wf, /git clone --no-tags "https:\/\/github\.com\/\$\{NEVILLE_REPO\}\.git"/);
  assert.match(wf, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(wf, /merge-base --is-ancestor/);
  assert.ok(wf.indexOf('merge-base --is-ancestor') < wf.indexOf('secrets.'));
});

test('workflow: neville is checked out outside the workspace', () => {
  assert.match(wf, /NEVILLE_DEST: \$\{\{ runner\.temp \}\}\/neville/);
  assert.match(wf, /NEVILLE_DIR: \$\{\{ runner\.temp \}\}\/neville\/ios-shell/);
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
