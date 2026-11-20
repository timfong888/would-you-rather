import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  assert.match(src, /const TEST_UNLOCK_UI = Platform\.OS === 'web' && process\.env\.EXPO_PUBLIC_TEST_UNLOCK === '1' && TEST_UNLOCK;/);
  assert.match(src, /\{TEST_UNLOCK_UI && paymentState === 'sheet' && \(/);
  assert.match(src, /\{TEST_UNLOCK_UI && purchasesAvailable && \(/);
  assert.match(src, /if \(!TEST_UNLOCK_UI \|\| paymentState !== 'sheet'\) return;/);
});

test('no EAS build carries the free test unlock (web-only, decision A 2026-11-20)', () => {
  const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
  for (const [name, profile] of Object.entries<any>(eas.build)) {
    assert.equal(profile.env?.EXPO_PUBLIC_TEST_UNLOCK, undefined, `eas.json profile ${name}`);
  }
  assert.equal(existsSync('app.config.js'), false, 'no 99.x test version layer');
  for (const profile of ['preview', 'development', 'production']) {
    const r = spawnSync(process.execPath, ['scripts/check-rc-keys.mjs'], {
      env: { ...process.env, EAS_BUILD_PROFILE: profile, EXPO_PUBLIC_TEST_UNLOCK: '1', EXPO_PUBLIC_DEPLOY_ENV: profile, EXPO_PUBLIC_RC_IOS_KEY: 'appl_x' },
      encoding: 'utf8',
    });
    assert.equal(r.status, 1, `${profile}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /EXPO_PUBLIC_TEST_UNLOCK is set/);
  }
});

test('TEST_UNLOCK is gated on Platform.OS === web inline (native bundles drop it)', () => {
  const src = readFileSync('contexts/UnlockedContext.tsx', 'utf8');
  assert.match(src, /export const TEST_UNLOCK =\s*Platform\.OS === 'web' &&\s*process\.env\.EXPO_PUBLIC_TEST_UNLOCK === '1' &&/);
});

test('test mode offers the pack: "unlock every category" renders and unlocks all', () => {
  const src = readFileSync('app/unlock/[id].tsx', 'utf8');
  // The pack button renders with real purchases OR the test unlock.
  assert.match(src, /\{\(purchasesAvailable \|\| TEST_UNLOCK_UI\) && \(/);
  // In test mode it opens the sheet as the pack, and paying calls unlockAll().
  assert.match(src, /setSheetKind\('all'\);\s*setPaymentState\('sheet'\);/);
  assert.match(src, /if \(sheetKind === 'all'\) unlockAll\(\);\s*else unlock\(id as CategoryId\);/);
  // unlockAll is a test-only no-op outside TEST_UNLOCK (it goes through unlock()).
  const ctx = readFileSync('contexts/UnlockedContext.tsx', 'utf8');
  assert.match(ctx, /const unlockAll = useCallback\(\(\) => unlock\(ENTITLEMENT_ALL as CategoryId\), \[unlock\]\);/);
  assert.match(ctx, /const unlock = useCallback\(\(id: CategoryId\) => \{\s*if \(!TEST_UNLOCK\) return;/);
});

test('a locked question URL never renders blank: it shows a locked card and redirects to the paywall', () => {
  const src = readFileSync('app/game/[id].tsx', 'utf8');
  assert.doesNotMatch(src, /if \(mustRedirect\) return null;/);
  assert.match(src, /router\.replace\(`\/unlock\/\$\{category\.id\}`\)/);
  assert.match(src, /This question is part of \{category\.label\}/);
});

test('entitlementsLoaded is set only after the first fetch settles, with a timeout (Sinatra P1)', () => {
  const ctx = readFileSync('contexts/UnlockedContext.tsx', 'utf8');
  assert.match(ctx, /useState<boolean>\(\(\) => !purchases\.isAvailable\(\)\)/);
  assert.match(ctx, /setTimeout\(markLoaded, ENTITLEMENTS_LOAD_TIMEOUT_MS\)/);
  // markLoaded runs in finally, after the then() that stores the entitlements.
  const fetch = ctx.slice(ctx.indexOf('const loadTimeout'), ctx.indexOf('const unsubscribe'));
  assert.ok(fetch.indexOf('setEntitlements(') < fetch.indexOf('.finally('));
});
