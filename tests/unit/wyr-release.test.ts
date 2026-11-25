// The WYR TestFlight build (.github/workflows/wyr-ios-testflight.yml). Secrets go to this workflow, so the guard
// rails are pinned here: dispatch gate, merged-sha check, fixed profile, secrets in one step, pinned actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { readFileSync, mkdtempSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore plain .mjs module
import { parseWyrEasBuild, wyrSummaryMarkdown, checkWyrSelfContained, isLocalPlugin, isNonRegistrySpec, parseBuildVersionGet, checkNextBuildNumber, WYR_PREVIEW_PROFILE, WYR_APP_ID, WYR_BUNDLE_ID, WYR_PROFILE, WYR_MIN_BUILD } from '../../scripts/lib/wyrRelease.mjs';
// @ts-ignore plain .mjs module
import { makeRedactor } from '../../scripts/lib/ascAppsList.mjs';
// @ts-ignore plain .mjs module
import { tailLines, tailErrors } from '../../scripts/lib/nevilleRelease.mjs';

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

// ---- the secretless self-containment check (#233 review): the clone runs with EXPO_TOKEN and the ASC key in eas-cli ----
const real = (f: string) => readFileSync(join(root, f), 'utf8');
function tree(mutate: (dir: string) => void = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wyr-check-'));
  for (const f of ['package.json', 'package-lock.json', 'app.json', 'eas.json', 'metro.config.js', 'babel.config.js']) writeFileSync(join(dir, f), real(f));
  mutate(dir);
  const r = checkWyrSelfContained(dir, { fs });
  rmSync(dir, { recursive: true, force: true });
  return r;
}
const edit = (dir: string, f: string, fn: (j: any) => void) => { const j = JSON.parse(readFileSync(join(dir, f), 'utf8')); fn(j); writeFileSync(join(dir, f), JSON.stringify(j)); };
const errs = (r: { errors: string[] }) => r.errors.join(' | ');

test('check: the real repo tree passes (so the workflow does not block today)', () => {
  const r = tree();
  assert.deepEqual(r.errors, []);
  assert.ok(r.lines.some((l: string) => /plugins: package names only/.test(l)));
  assert.ok(r.lines.some((l: string) => /registry URLs only/.test(l)));
});

test('check: .npmrc*, .yarnrc*, .env*, app.config.* (any extension), fingerprint.config.*, credentials.json each fail', () => {
  for (const f of ['.npmrc', '.npmrc.local', '.yarnrc', '.yarnrc.yml', 'app.config.js', 'app.config.ts', 'app.config.json', 'app.config.mts', 'app.config.cts', 'app.config.mjs', 'app.config.cjs', 'app.config.foo', '.env', '.env.local', '.env.production', '.env.preview', 'fingerprint.config.js', 'fingerprint.config.ts', 'credentials.json']) {
    assert.match(errs(tree((d) => writeFileSync(join(d, f), 'x'))), /not allowed/, f);
  }
});

test('check: a symlink anywhere fails (top level and nested)', () => {
  assert.match(errs(tree((d) => symlinkSync('/etc/passwd', join(d, 'link')))), /symlink/);
  assert.match(errs(tree((d) => { mkdirSync(join(d, 'sub')); symlinkSync('/tmp', join(d, 'sub', 'x')); })), /symlink/);
  assert.match(errs(tree((d) => { rmSync(join(d, 'app.json')); symlinkSync(join(root, 'app.json'), join(d, 'app.json')); })), /symlink/);
});

test('check: plugins must be plain package names', () => {
  for (const bad of ['./plugins/x', '../x', '/abs/x', 'file:./x', 'C:\\x', '~/x']) {
    assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push(bad); }))), /plugin/, bad);
  }
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push(['./local', {}]); }))), /plugin/);
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push({ not: 'a name' }); }))), /plugin/);
  assert.equal(isLocalPlugin('expo-font'), false);
  assert.equal(isLocalPlugin(['expo-router', { origin: 'https://x' }]), false);
  assert.equal(isLocalPlugin('@scope/pkg'), false);
});

test('check: workspaces and non-registry dependencies fail (path, workspace, git, github shorthand, URL, in overrides too)', () => {
  assert.match(errs(tree((d) => edit(d, 'package.json', (j) => { j.workspaces = ['a']; }))), /workspaces/);
  for (const spec of ['file:../x', 'file:./vendor/x', 'link:../x', 'workspace:*', 'git+https://github.com/a/b.git', 'github:a/b', 'a/b', 'https://x.example/p.tgz', '/abs/x', '../x']) {
    assert.match(errs(tree((d) => edit(d, 'package.json', (j) => { j.dependencies.evil = spec; }))), /not from the npm registry/, spec);
    assert.match(errs(tree((d) => edit(d, 'package.json', (j) => { j.overrides = { ...(j.overrides || {}), evil: spec }; }))), /not from the npm registry/, `override ${spec}`);
  }
  assert.equal(isNonRegistrySpec('~54.0.12'), false);
  assert.equal(isNonRegistrySpec('^1.2.3'), false);
  assert.equal(isNonRegistrySpec('npm:left-pad@1.3.0'), false);
});

test('check: lockfile entries outside the npm registry, links and local installs fail', () => {
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.packages['node_modules/evil'] = { version: '1.0.0', resolved: 'https://evil.example/e.tgz' }; }))), /outside https:\/\/registry\.npmjs\.org/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.packages['node_modules/evil'] = { resolved: 'http://registry.npmjs.org/e.tgz' }; }))), /outside/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.packages['node_modules/evil'] = { resolved: '../x', link: true }; }))), /link/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.packages.vendor = { version: '1.0.0' }; }))), /local path/);
});

test('check: metro/babel config that loads local files, spawns, reads env or uses the network fails', () => {
  for (const line of ["require('./x')", "require('/abs')", "require('child_process').execSync('x')", 'fetch("x")', "process.env.EXPO_TOKEN", "import('x')", 'eval("1")']) {
    assert.match(errs(tree((d) => writeFileSync(join(d, 'metro.config.js'), `${line};\n`))), /metro\.config\.js has lines/, line);
  }
});

test('check: wrong bundle id, missing or non-store preview profile, wrong ascAppId fail', () => {
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.ios.bundleIdentifier = 'pckg.neville'; }))), /bundleIdentifier/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { delete j.build.preview; }))), /no build profile/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.distribution = 'internal'; }))), /not a store build/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.submit.preview.ios.ascAppId = '1'; }))), /ascAppId/);
});

test('check: a missing checkout or a symlinked root fails closed', () => {
  assert.match(errs(checkWyrSelfContained('/nonexistent/wyr-check', { fs })), /does not exist/);
  const d = mkdtempSync(join(tmpdir(), 'wyr-root-'));
  const l = join(tmpdir(), `wyr-link-${process.pid}`);
  symlinkSync(d, l);
  assert.match(errs(checkWyrSelfContained(l, { fs })), /not a real directory/);
  rmSync(l); rmSync(d, { recursive: true, force: true });
});

test('workflow order: self-contained check, then eas-cli install, then npm ci, all before the only secret step', () => {
  const i = (needle: string) => wf.indexOf(needle);
  assert.ok(i('node scripts/wyr-check.mjs') > i('merge-base --is-ancestor'));
  assert.ok(i('node scripts/wyr-check.mjs') < i('npm install --ignore-scripts'));
  assert.ok(i('npm install --ignore-scripts') < i('npm ci --ignore-scripts'));
  assert.ok(i('npm ci --ignore-scripts') < i('secrets.EXPO_TOKEN'));
  assert.match(wf, /eas-cli@27\.11\.0/);
  assert.match(wf, /EAS_BIN: \$\{\{ runner\.temp \}\}\/eas\/node_modules\/\.bin\/eas/);
  assert.ok(!/npx/.test(script.replace(/\/\/.*$/gm, '')), 'the secret step never runs npx');
  const npmSteps = wf.split('\n      - ').slice(1).filter((x) => /npm (ci|install)/.test(x));
  assert.equal(npmSteps.length, 2);
  for (const st of npmSteps) { assert.match(st, /NPM_CONFIG_USERCONFIG: \/dev\/null/); assert.match(st, /NPM_CONFIG_REGISTRY: https:\/\/registry\.npmjs\.org\//); assert.match(st, /--ignore-scripts/); }
  assert.match(script, /NPM_CONFIG_USERCONFIG: '\/dev\/null'/);
  assert.match(script, /spawnSync\(easBin,/);
});

test('failure tails redact the whole text first (a multi-line PEM, the token, the key id) and cannot start a workflow command', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49\nAwEHBG0wawIBAQQg\n-----END PRIVATE KEY-----';
  const redact = makeRedactor(['expo_tok_SECRET123', 'KEYID12345', 'ISSUER-uuid-1', pem, 'VJKU43W3C2']);
  const text = `boom ${pem}\nusing expo_tok_SECRET123 and KEYID12345 and ISSUER-uuid-1 team VJKU43W3C2\nsee https://expo.dev/x?token=abc\n::error::injected\n   ::set-env name=A::b`;
  for (const out of [tailLines(text, redact, 60), tailErrors(text, redact)]) {
    for (const secret of ['expo_tok_SECRET123', 'KEYID12345', 'ISSUER-uuid-1', 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49', 'AwEHBG0wawIBAQQg', 'VJKU43W3C2', 'token=abc']) assert.ok(!out.includes(secret), `leaked ${secret}`);
    for (const l of out.split('\n')) assert.ok(l === '' || l.startsWith('| '), `line can start a command: ${l}`);
  }
});

test('check: lockfile must be version 3 with no legacy dependencies tree (v1/v2 trees are honored by npm ci)', () => {
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.lockfileVersion = 2; }))), /not lockfileVersion 3/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.lockfileVersion = 1; }))), /not lockfileVersion 3/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { j.dependencies = { evil: { version: 'git+https://evil.example/e.git' } }; }))), /legacy dependencies tree/);
  assert.match(errs(tree((d) => edit(d, 'package-lock.json', (j) => { delete j.lockfileVersion; }))), /not lockfileVersion 3/);
});

test('check: a plugin named after the package itself, or a package.json exports field, fails', () => {
  const name = JSON.parse(real('package.json')).name;
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push(name); }))), /named after this package/);
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push([name, {}]); }))), /named after this package/);
  assert.match(errs(tree((d) => edit(d, 'app.json', (j) => { j.expo.plugins.push(`${name}/plugin`); }))), /named after this package/);
  assert.match(errs(tree((d) => edit(d, 'package.json', (j) => { j.exports = { './plugin': './x.js' }; }))), /exports field/);
});

test('check: the preview profile is pinned exactly; credentialsSource, extends, resourceClass, other keys fail', () => {
  assert.deepEqual(JSON.parse(real('eas.json')).build.preview, WYR_PREVIEW_PROFILE); // the pin matches what is committed today
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.credentialsSource = 'local'; }))), /credentialsSource|differs/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.extends = 'development'; }))), /extends|differs/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.ios.resourceClass = 'm-large'; }))), /differs/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.env.NODE_OPTIONS = '--require x'; }))), /differs/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.build.preview.prebuildCommand = 'x'; }))), /differs/);
  assert.match(errs(tree((d) => edit(d, 'eas.json', (j) => { j.cli.appVersionSource = 'local'; }))), /appVersionSource/);
  assert.deepEqual(tree((d) => edit(d, 'eas.json', (j) => { j.build.development.extends = 'x'; })).errors, []); // other profiles are not the build's concern
});

test('remote build number: the next number must not be under 23, checked before the build', () => {
  assert.equal(parseBuildVersionGet(JSON.stringify({ buildNumber: '22' })), 22);
  assert.equal(parseBuildVersionGet('Build number: 22\n'), 22);
  assert.equal(parseBuildVersionGet('22'), 22);
  assert.throws(() => parseBuildVersionGet('no number here'), /could not read/);
  assert.equal(checkNextBuildNumber(22), 23);
  assert.equal(checkNextBuildNumber(30), 31);
  assert.throws(() => checkNextBuildNumber(21), /under the floor 23/);
  assert.throws(() => checkNextBuildNumber(0), /under the floor/);
  assert.throws(() => checkNextBuildNumber(NaN), /usable number/);
  // the script runs the read-only command before `eas build`, and refuses (die) on failure or a low number
  const iv = script.indexOf("'build:version:get'");
  const ib = script.indexOf("'build', '--platform'");
  assert.ok(iv > 0 && ib > iv, 'build:version:get runs before eas build');
  assert.match(script, /not starting a build/i);
  assert.match(script, /checkNextBuildNumber\(parseBuildVersionGet/);
});

test('workflow comments do not claim the check proves anything', () => {
  assert.ok(!/refuses anything that could/i.test(wf));
  assert.match(wf, /blocklist, not a proof/);
});
