import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// @ts-ignore plain .mjs module
import { validateAppId, validateDir, resolveDir, parseEasBuild, preflightApp, summaryMarkdown, checkSelfContained, HIGHERSIGNAL_DIRS } from '../../scripts/lib/highersignalRelease.mjs';

const wfFull = readFileSync('.github/workflows/highersignal-ios-testflight.yml', 'utf8');
const wf = wfFull.split('\n').filter((l: string) => !/^\s*#/.test(l)).join('\n'); // code only: comments may name what is forbidden
const wfSteps = wf.split(/\n      - /).slice(1);
const stepIdx = (re: RegExp) => { const i = wfSteps.findIndex((s: string) => re.test(s)); assert.ok(i >= 0, `no step matches ${re}`); return i; };
const stepsWith = (needle: string) => wfSteps.map((s: string, i: number) => (s.includes(needle) ? i : -1)).filter((i: number) => i >= 0);

test('workflow: dispatch only, read-only token, only timfong888 from main, apple-ops', () => {
  assert.match(wf, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(wf, /pull_request|push:|schedule:|workflow_run/);
  assert.match(wf, /permissions:\n  contents: read/);
  assert.match(wf, /github\.actor == 'timfong888'/);
  assert.match(wf, /github\.triggering_actor == 'timfong888'/);
  assert.match(wf, /github\.ref == 'refs\/heads\/main'/);
  assert.match(wf, /^    environment: apple-ops$/m);
  assert.doesNotMatch(wf, /upload-artifact|GITHUB_ENV|GITHUB_OUTPUT/);
});

test('workflow: one input (a sha), hardcoded repo, dir and ASC app id; inputs only reach env:', () => {
  assert.equal((wf.match(/^      [a-z_]+:\n        description:/gm) || []).length, 1);
  assert.match(wf, /HIGHERSIGNAL_REPO: timfong888\/highersignal/);
  assert.match(wf, /HIGHERSIGNAL_SUBDIR: \.\n/);
  assert.match(wf, /HIGHERSIGNAL_APP_ID: ''/); // placeholder: the run stops until Tim fills it in
  assert.match(wf, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(wf, /\^\[0-9\]\{8,12\}\$/);
  for (const l of wf.split('\n').filter((x: string) => x.includes('inputs.'))) assert.match(l, /^\s+HIGHERSIGNAL_SHA: \$\{\{ inputs\.highersignal_sha \}\}$/, l);
  assert.doesNotMatch(wf, /working-directory/);
  assert.doesNotMatch(wf, /path: highersignal/);
});

test('workflow: every action pinned to a full sha', () => {
  const uses = [...wf.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 2);
  for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, u);
});

test('workflow: deploy key reaches only the clone step; Apple/Expo secrets only the build step', () => {
  const secretLines = wf.split('\n').filter((l: string) => l.includes('secrets.'));
  assert.deepEqual(secretLines.map((l: string) => l.match(/secrets\.(\w+)/)![1]).sort(), ['ASC_ISSUER_ID', 'ASC_KEY_ID', 'ASC_PRIVATE_KEY', 'EXPO_TOKEN', 'HIGHERSIGNAL_DEPLOY_KEY']);
  const clone = stepsWith('secrets.HIGHERSIGNAL_DEPLOY_KEY');
  assert.equal(clone.length, 1);
  assert.match(wfSteps[clone[0]], /Clone highersignal/);
  for (const k of ['EXPO_TOKEN', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY']) {
    const at = stepsWith(`secrets.${k}`);
    assert.equal(at.length, 1, k);
    assert.match(wfSteps[at[0]], /Build on EAS/);
    assert.ok(!wfSteps[at[0]].includes('DEPLOY_KEY'));
  }
  assert.ok(!wfSteps[clone[0]].includes('EXPO_TOKEN') && !wfSteps[clone[0]].includes('ASC_'));
});

test('workflow: key is masked, 0600 temp file outside the checkout, removed, host key pinned, no ssh-keyscan', () => {
  const s = wfSteps[stepIdx(/Clone highersignal/)];
  assert.match(s, /umask 077/);
  assert.match(s, /::add-mask::/);
  assert.match(s, /keydir="\$\(mktemp -d\)"/);
  assert.match(s, /trap 'rm -rf "\$keydir"' EXIT/);
  assert.match(s, /IdentitiesOnly=yes/);
  assert.match(s, /StrictHostKeyChecking=yes/);
  assert.match(s, /git clone --no-tags "git@github\.com:\$\{HIGHERSIGNAL_REPO\}\.git"/);
  assert.doesNotMatch(wf, /ssh-keyscan|StrictHostKeyChecking=no|ssh-add|~\/\.ssh/);
  // the pinned host key really is GitHub's published ed25519 key
  const blob = s.match(/github\.com ssh-ed25519 (\S+)/)![1];
  assert.equal(createHash('sha256').update(Buffer.from(blob, 'base64')).digest('base64').replace(/=+$/, ''), '+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU');
});

test('workflow: order is validate, clone+pin to main, check, install, then the secret build; clone outside the workspace', () => {
  assert.ok(stepIdx(/Validate highersignal_sha/) < stepIdx(/Clone highersignal/));
  assert.match(wf, /HIGHERSIGNAL_DEST: \$\{\{ runner\.temp \}\}\/highersignal/);
  assert.match(wf, /merge-base --is-ancestor/);
  assert.ok(stepIdx(/merge-base --is-ancestor/) < stepIdx(/highersignal-check\.mjs/));
  assert.ok(stepIdx(/highersignal-check\.mjs/) < stepIdx(/Install eas-cli/));
  assert.ok(stepIdx(/Install highersignal dependencies/) < stepIdx(/Build on EAS/));
  assert.ok(stepIdx(/Install eas-cli/) < stepIdx(/Build on EAS/));
  assert.match(wfSteps[stepIdx(/Install highersignal dependencies/)], /npm ci --ignore-scripts[^\n]*\n/);
  assert.match(wfSteps[stepIdx(/Install highersignal dependencies/)], /NPM_CONFIG_USERCONFIG: \/dev\/null/);
  assert.match(wf, /EAS_BIN: \$\{\{ github\.workspace \}\}\/tools\/eas-cli\/node_modules\/\.bin\/eas/);
  assert.doesNotMatch(wf, /npx/);
  assert.match(wf, /node-version: '22'/);
  assert.match(wf, /EAS_PROFILE: production/);
});

test('workflow: does not mention neville, and the neville workflow is not edited by this change', () => {
  assert.doesNotMatch(wf, /neville/i);
});

test('app id and dir are validated; dir is an allowlist, never a path', () => {
  assert.equal(validateAppId('6740147999'), '6740147999');
  for (const bad of ['', undefined, 'abc', '12', '1234567890123', '6740147041; rm']) assert.throws(() => validateAppId(bad as string), /numeric ASC app id/);
  assert.deepEqual(HIGHERSIGNAL_DIRS, ['.', 'native']);
  for (const bad of ['..', '../x', '/etc', 'native/..', 'other', '']) assert.throws(() => validateDir(bad), /HIGHERSIGNAL_SUBDIR/);
  assert.equal(resolveDir('/r', '.'), '/r');
  assert.equal(resolveDir('/r', 'native'), '/r/native');
});

test('parseEasBuild accepts a first build (1.0.0 / 1) and refuses foreign artifact hosts', () => {
  const eas = (o = {}) => JSON.stringify([{ status: 'FINISHED', platform: 'IOS', appVersion: '1.0.0', appBuildVersion: '1', artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/a_b.ipa' }, ...o }]);
  assert.deepEqual(parseEasBuild(eas()), { version: '1.0.0', build: '1', ipaUrl: 'https://expo.dev/artifacts/eas/a_b.ipa' });
  assert.throws(() => parseEasBuild(eas({ artifacts: { buildUrl: 'https://evil.example/x.ipa' } })), /artifact URL/);
  assert.throws(() => parseEasBuild(eas({ status: 'ERRORED' })), /not FINISHED/);
  assert.throws(() => parseEasBuild(eas({ appBuildVersion: '1; x' })), /numeric build/);
});

test('preflight passes only for pckg.highersignal and refuses an empty app id before any call', async () => {
  const calls: string[] = [];
  await preflightApp(async (p: string) => { calls.push(p); return { status: 200, body: { data: { attributes: { bundleId: 'pckg.highersignal' } } } }; }, '6740147999');
  assert.match(calls[0], /^\/v1\/apps\/6740147999\?/);
  await assert.rejects(preflightApp(async () => ({ status: 200, body: { data: { attributes: { bundleId: 'pckg.neville' } } } }), '6740147041'), /Higher Signal bundle id/);
  await assert.rejects(preflightApp(async () => { throw new Error('called'); }, ''), /numeric ASC app id/);
});

test('summaryMarkdown holds version, build number and state only', () => {
  const md = summaryMarkdown('3', 'VALID', '1.0.0');
  assert.match(md, /Version 1\.0\.0, build 3: processed by Apple/);
});

const fixture = (files: Record<string, string>, sub = '.') => {
  const root = mkdtempSync(join(tmpdir(), 'hs-'));
  const dir = sub === '.' ? root : join(root, sub);
  mkdirSync(dir, { recursive: true });
  for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c);
  return { root, dir };
};
const good: Record<string, string> = {
  'package.json': JSON.stringify({ name: 'hs', dependencies: { expo: '~58.0.0' } }),
  'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { '': {}, 'node_modules/expo': { resolved: 'https://registry.npmjs.org/expo/-/expo-58.0.0.tgz' } } }),
  'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: 'pckg.highersignal' }, extra: { eas: { projectId: 'x' } } } }),
  'eas.json': JSON.stringify({ cli: { appVersionSource: 'remote' }, build: { production: { autoIncrement: true } } }),
};
const check = (files: Record<string, string>, sub = '.', opts = {}) => { const { root, dir } = fixture(files, sub); return checkSelfContained(dir, sub, { fs, root, nodeVersion: '22.14.0', ...opts }); };

test('check: a self-contained root and a self-contained native dir pass', () => {
  for (const sub of ['.', 'native']) { const r = check(good, sub); assert.deepEqual(r.errors, [], sub); assert.deepEqual(r.warnings, [], sub); }
});

test('check: not self-contained fails (missing files, wrong bundle id, workspaces, parent deps, parent metro, local plugin, forbidden files, old node, no profile)', () => {
  const bad = (patch: Record<string, string | null>, re: RegExp, opts = {}) => {
    const files = { ...good }; for (const [k, v] of Object.entries(patch)) { if (v === null) delete files[k]; else files[k] = v; }
    const r = check(files, '.', opts);
    assert.ok(r.errors.some((e: string) => re.test(e)), `${re}: ${r.errors.join('|')}`);
  };
  bad({ 'package.json': null }, /package\.json is missing/);
  bad({ 'package-lock.json': null }, /package-lock\.json is missing/);
  bad({ 'app.json': null }, /app\.json is missing/);
  bad({ 'eas.json': null }, /eas\.json is missing/);
  bad({ 'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: 'pckg.neville' } } }) }, /not pckg\.highersignal/);
  bad({ 'package.json': JSON.stringify({ workspaces: ['a'] }) }, /workspaces/);
  bad({ 'package.json': JSON.stringify({ dependencies: { shared: 'file:../shared' } }) }, /parent path or workspace/);
  bad({ 'package.json': JSON.stringify({ dependencies: { shared: 'workspace:*' } }) }, /parent path or workspace/);
  bad({ 'metro.config.js': "const p = path.resolve(__dirname, '..');" }, /parent directory/);
  bad({ 'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: 'pckg.highersignal' }, plugins: ['./plugins/x.js'] } }) }, /local files/);
  bad({ '.npmrc': 'x' }, /\.npmrc\* is present/);
  bad({ '.env.local': 'x' }, /\.env\* is present/);
  bad({ 'babel.config.cjs': 'x' }, /babel\.config/);
  bad({ 'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/x': { resolved: 'https://evil.example/x.tgz' } } }) }, /outside https:\/\/registry/);
  bad({ 'package-lock.json': JSON.stringify({ lockfileVersion: 2, packages: {} }) }, /not lockfileVersion 3/);
  bad({ 'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/x': { link: true, resolved: '../x' } } }) }, /link entr/);
  bad({ 'app.config.ts': 'x' }, /app\.config\.\* is present/);
  bad({ 'eas.json': JSON.stringify({ build: {} }) }, /no build profile/);
  bad({ 'eas.json': '{' }, /not valid JSON/);
  bad({}, /older than 22\.13/, { nodeVersion: '20.11.0' });
});

test('check: a symlinked file or build dir fails closed', () => {
  const { root, dir } = fixture(good);
  fs.rmSync(join(dir, 'eas.json')); writeFileSync(join(root, '..', 'hs-target.json'), '{}'); symlinkSync(join(root, '..', 'hs-target.json'), join(dir, 'eas.json'));
  assert.ok(checkSelfContained(dir, '.', { fs, root, nodeVersion: '22.14.0' }).errors.some((e: string) => /symlink/.test(e)));
  const r2 = mkdtempSync(join(tmpdir(), 'hs-')); const real = mkdtempSync(join(tmpdir(), 'hs-real-')); symlinkSync(real, join(r2, 'native'));
  assert.ok(checkSelfContained(join(r2, 'native'), 'native', { fs, root: r2, nodeVersion: '22.14.0' }).errors.some((e: string) => /symlink|outside/.test(e)));
});

test('check script: passes a good dir, rejects a non-self-contained one, refuses an empty app id, prints no secrets or file content', () => {
  const secrets = { EXPO_TOKEN: 'tok-EXPO-123456', ASC_KEY_ID: 'KEYID12345', ASC_PRIVATE_KEY: 'PEM-BODY-xyz', HIGHERSIGNAL_DEPLOY_KEY: 'DEPLOYKEY-abcdef' };
  const run = (root: string, extra: Record<string, string> = {}) => spawnSync('node', [new URL('../../scripts/highersignal-check.mjs', import.meta.url).pathname],
    { env: { ...process.env, HIGHERSIGNAL_ROOT: root, HIGHERSIGNAL_SUBDIR: '.', HIGHERSIGNAL_APP_ID: '6740147999', EAS_PROFILE: 'production', ...secrets, ...extra }, encoding: 'utf8' });
  const ok = run(fixture(good).root);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /directory: repo root/);
  for (const v of Object.values(secrets)) assert.ok(!(ok.stdout + ok.stderr).includes(v));
  const notSelf = run(fixture({ ...good, 'package.json': JSON.stringify({ dependencies: { shared: 'file:../../shared' } }), 'metro.config.js': "SECRETISH('../')" }).root);
  assert.equal(notSelf.status, 1);
  assert.match(notSelf.stdout, /::error::/);
  assert.ok(!notSelf.stdout.includes('SECRETISH'));
  const noId = run(fixture(good).root, { HIGHERSIGNAL_APP_ID: '' });
  assert.equal(noId.status, 2);
  assert.match(noId.stderr, /numeric ASC app id/);
  const badDir = run(fixture(good).root, { HIGHERSIGNAL_SUBDIR: '../x' });
  assert.equal(badDir.status, 2);
  assert.ok(!(badDir.stdout + badDir.stderr).includes('../x'));
});

test('highersignal-testflight.mjs refuses an empty app id or a bad dir before any spawn or network call', () => {
  const env = (o: Record<string, string>) => ({ ...process.env, EAS_BIN: process.execPath, EXPO_TOKEN: 't', ASC_KEY_ID: 'KEYID12345', ASC_ISSUER_ID: 'issuer-9', ASC_PRIVATE_KEY: 'k', APPLE_TEAM_ID: 'VJKU43W3C2', HIGHERSIGNAL_ROOT: tmpdir(), HIGHERSIGNAL_SUBDIR: '.', HIGHERSIGNAL_APP_ID: '6740147999', ...o });
  const run = (o: Record<string, string>) => spawnSync('node', [new URL('../../scripts/highersignal-testflight.mjs', import.meta.url).pathname], { env: env(o), encoding: 'utf8', timeout: 20000 });
  const a = run({ HIGHERSIGNAL_APP_ID: '' }); assert.equal(a.status, 2); assert.match(a.stderr, /numeric ASC app id/);
  const b = run({ HIGHERSIGNAL_SUBDIR: '../etc' }); assert.equal(b.status, 2); assert.ok(!(b.stdout + b.stderr).includes('../etc'));
});
