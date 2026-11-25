// The WYR TestFlight build (.github/workflows/wyr-ios-testflight.yml). Secrets go to this workflow, so the guard
// rails are pinned here: dispatch gate, merged-sha check, fixed profile, secrets in one step, pinned actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain .mjs module
import { parseWyrEasBuild, wyrSummaryMarkdown, WYR_APP_ID, WYR_BUNDLE_ID, WYR_PROFILE, WYR_MIN_BUILD } from '../../scripts/lib/wyrRelease.mjs';

const root = join(__dirname, '../..');
const wf = readFileSync(join(root, '.github/workflows/wyr-ios-testflight.yml'), 'utf8');
const script = readFileSync(join(root, 'scripts/wyr-testflight.mjs'), 'utf8');
const eas = (o: Record<string, unknown> = {}) => JSON.stringify([{
  status: 'FINISHED', platform: 'IOS', appVersion: '1.0.0', appBuildVersion: '23',
  artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/abc_123.ipa' }, ...o }]);

test('app id, bundle id and profile match app.json and eas.json', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const easJson = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  assert.equal(WYR_BUNDLE_ID, app.expo.ios.bundleIdentifier);
  assert.equal(WYR_APP_ID, easJson.submit.preview.ios.ascAppId);
  assert.ok(easJson.build[WYR_PROFILE], 'preview profile exists in eas.json');
  assert.equal(WYR_PROFILE, 'preview');
});

test('parseWyrEasBuild accepts build 23 / 1.0.0 and returns version, build, ipa url', () => {
  assert.deepEqual(parseWyrEasBuild(eas()), { version: '1.0.0', build: '23', ipaUrl: 'https://expo.dev/artifacts/eas/abc_123.ipa' });
  assert.equal(WYR_MIN_BUILD, 23);
});

test('parseWyrEasBuild refuses a build that goes backwards, a bad url, a failed build, android, bad json', () => {
  assert.throws(() => parseWyrEasBuild(eas({ appBuildVersion: '22' })), /at least 23/);
  assert.throws(() => parseWyrEasBuild(eas({ artifacts: { buildUrl: 'https://evil.example/x.ipa' } })), /artifact URL/);
  assert.throws(() => parseWyrEasBuild(eas({ artifacts: { buildUrl: 'http://expo.dev/artifacts/eas/a.ipa' } })), /artifact URL/);
  assert.throws(() => parseWyrEasBuild(eas({ status: 'ERRORED' })), /not FINISHED/);
  assert.throws(() => parseWyrEasBuild(eas({ platform: 'ANDROID' })), /not an iOS/);
  assert.throws(() => parseWyrEasBuild(eas({ appBuildVersion: 'abc' })), /numeric build/);
  assert.throws(() => parseWyrEasBuild('not json'), /JSON/);
});

test('summary reports build number and state only', () => {
  const md = wyrSummaryMarkdown('23', 'VALID', '1.0.0');
  assert.match(md, /Version 1\.0\.0, build 23: processed by Apple/);
  assert.match(wyrSummaryMarkdown('23', 'PROCESSING', '1.0.0'), /build 23: PROCESSING/);
});

test('workflow: dispatch only, only by timfong888, only from main, this repo', () => {
  assert.match(wf, /^on:\n  workflow_dispatch:/m);
  assert.ok(!/pull_request|push:|schedule:|workflow_run/.test(wf.replace(/#.*$/gm, '')), 'no other trigger');
  const gate = wf.split('\n').find((l) => l.trim().startsWith('if:')) || '';
  for (const part of ["github.event_name == 'workflow_dispatch'", "github.actor == 'timfong888'", "github.triggering_actor == 'timfong888'", "github.repository == 'timfong888/would-you-rather'", "github.ref == 'refs/heads/main'"]) {
    assert.ok(gate.includes(part), `gate missing ${part}`);
  }
  assert.match(wf, /permissions:\n  contents: read/);
});

test('workflow: sha is validated and must be an ancestor of main before any secret; it only reaches the shell through env', () => {
  assert.match(wf, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(wf, /merge-base --is-ancestor "\$WYR_SHA" origin\/main/);
  assert.ok(!/\$\{\{\s*inputs\./.test(wf.split('run:').slice(1).map((b) => b.split('\n      - ')[0]).join('\n')), 'inputs are never interpolated into a run: script');
  assert.ok(wf.indexOf('merge-base --is-ancestor') < wf.indexOf('secrets.EXPO_TOKEN'));
});

test('workflow: the profile is fixed to preview, never an input', () => {
  assert.match(wf, /EAS_PROFILE: preview/);
  assert.ok(!/inputs\.(profile|eas_profile)/.test(wf));
  assert.match(script, /EAS_PROFILE must be/);
});

test('workflow: secrets appear in exactly one step, and the install step has none', () => {
  const steps = wf.split('\n      - ').slice(1);
  const withSecrets = steps.filter((s) => /secrets\./.test(s));
  assert.equal(withSecrets.length, 1);
  assert.match(withSecrets[0], /wyr-testflight\.mjs/);
  for (const k of ['EXPO_TOKEN', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY']) assert.ok(withSecrets[0].includes(`secrets.${k}`), k);
  const install = steps.find((s) => /npm ci/.test(s)) || '';
  assert.match(install, /--ignore-scripts/);
});

test('workflow: third-party actions are pinned to commit SHAs', () => {
  const uses = [...wf.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});

test('script: never prints secrets, hands the child an env allowlist, uses the shared uploader and redacted tails', () => {
  assert.match(script, /makeRedactor\(\[EXPO_TOKEN, ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID\]\)/);
  assert.match(script, /add-mask/);
  assert.match(script, /const childEnv = \{/);
  assert.match(script, /asc-upload\.mjs/);
  assert.match(script, /tailLines\(eas\.stderr, redact, 60\)/);
  assert.ok(!/console\.log\([^)]*(EXPO_TOKEN|ASC_PRIVATE_KEY)/.test(script));
  assert.match(script, /still-processing/);
});
