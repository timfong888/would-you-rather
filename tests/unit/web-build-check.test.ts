import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore: plain .mjs build script
import { envProblems, filesWithMarker, TEST_UNLOCK_MARKER, deployEnvFrom } from '../../scripts/check-web-build.mjs';

test('deploy env follows the build:web derivation', () => {
  assert.equal(deployEnvFrom({}), 'development');
  assert.equal(deployEnvFrom({ VERCEL_ENV: 'preview' }), 'preview');
  assert.equal(deployEnvFrom({ VERCEL_ENV: 'production' }), 'production');
  assert.equal(deployEnvFrom({ EXPO_PUBLIC_DEPLOY_ENV: 'preview' }), 'preview');
  // Vercel's own value wins: an explicit value cannot downgrade production.
  assert.equal(deployEnvFrom({ EXPO_PUBLIC_DEPLOY_ENV: 'preview', VERCEL_ENV: 'production' }), 'production');
});

test('a production Vercel build cannot be downgraded by EXPO_PUBLIC_DEPLOY_ENV', () => {
  const r = envProblems({ VERCEL_ENV: 'production', EXPO_PUBLIC_DEPLOY_ENV: 'preview', EXPO_PUBLIC_TEST_UNLOCK: '1', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_sb_x' });
  assert.equal(r.deployEnv, 'production');
  assert.equal(r.problems.length, 3); // conflict + flag + sandbox key
});

test('production fails with the test-unlock flag or a sandbox key', () => {
  assert.equal(envProblems({ VERCEL_ENV: 'production', EXPO_PUBLIC_TEST_UNLOCK: '1', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_x' }).problems.length, 1);
  assert.equal(envProblems({ VERCEL_ENV: 'production', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_sb_x' }).problems.length, 1);
  assert.equal(envProblems({ VERCEL_ENV: 'production', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_live' }).problems.length, 0);
});

test('previews and local builds fail with a live key', () => {
  assert.equal(envProblems({ VERCEL_ENV: 'preview', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_live' }).problems.length, 1);
  assert.equal(envProblems({ EXPO_PUBLIC_RC_WEB_KEY: 'rcb_live' }).problems.length, 1);
});

test('previews may carry the flag and a sandbox key', () => {
  assert.deepEqual(envProblems({ VERCEL_ENV: 'preview', EXPO_PUBLIC_TEST_UNLOCK: '1', EXPO_PUBLIC_RC_WEB_KEY: 'rcb_sb_x' }).problems, []);
});

test('the bundle scan finds the marker', () => {
  const hits = filesWithMarker([
    { path: 'a.js', text: `x("${TEST_UNLOCK_MARKER} · unlock without paying")` },
    { path: 'b.js', text: 'nothing here' },
  ]);
  assert.deepEqual(hits, ['a.js']);
});

test('the paywall source carries the marker only in TEST_UNLOCK_UI-guarded UI', () => {
  const src = readFileSync('app/unlock/[id].tsx', 'utf8');
  const lines = src.split('\n');
  const uiLines = lines.filter((l) => l.includes(TEST_UNLOCK_MARKER) && !l.trim().startsWith('//'));
  assert.ok(uiLines.length >= 1, 'marker must label the test-unlock UI so the production scan can see it');
  // The test-only UI and the simulated sheet are rendered behind the inline-folded constant.
  assert.match(src, /const TEST_UNLOCK_UI = process\.env\.EXPO_PUBLIC_TEST_UNLOCK === '1' && TEST_UNLOCK;/);
  assert.match(src, /\{TEST_UNLOCK_UI && paymentState === 'sheet' && \(/);
  assert.match(src, /\{TEST_UNLOCK_UI && purchasesAvailable && \(/);
  assert.match(src, /if \(!TEST_UNLOCK_UI \|\| paymentState !== 'sheet'\) return;/);
});

test('test-unlock builds get a version above any release that never equals one', async () => {
  // @ts-ignore: plain CommonJS config
  const { testUnlockVersion } = await import('../../app.config.js');
  assert.equal(testUnlockVersion('1.0.0'), '99.1.0');
  assert.equal(testUnlockVersion('2.3.4'), '99.2.3');
});
