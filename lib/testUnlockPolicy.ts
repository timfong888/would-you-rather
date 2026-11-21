/**
 * Where the free "test unlock" may exist. Pure, so it is unit-tested.
 *
 * Tim (2026-11-19) wants to walk the paywall flow without paying, but the real
 * RevenueCat paywall is what customers get. The free unlock (the simulated
 * checkout sheet, issue #53) is therefore a test-only switch:
 *
 * - web only. iOS/Android builds never have it (Tim, 2026-11-20, decision A:
 *   TestFlight is tested with Apple sandbox purchases, the real paywall);
 * - never on production (web production deploy), whatever the flag says;
 * - on a Vercel preview or a local web build only when EXPO_PUBLIC_TEST_UNLOCK
 *   is exactly "1";
 * - an unknown or missing deploy environment counts as production (fail closed).
 *
 * The deploy environment comes from EXPO_PUBLIC_DEPLOY_ENV, set by
 * `npm run build:web` from Vercel's VERCEL_ENV and by the `env` block of each
 * profile in eas.json. scripts/check-web-build.mjs and scripts/check-rc-keys.mjs
 * also fail a production build that carries the flag, and the exported
 * production web bundle is scanned for the test-unlock marker text
 * (TEST_UNLOCK_MARKER in scripts/check-web-build.mjs), which must only appear
 * inside code that the minifier drops when the flag is off.
 *
 * Callers must test `process.env.EXPO_PUBLIC_TEST_UNLOCK === '1'` inline as
 * well (see TEST_UNLOCK in app/unlock/[id].tsx), so Metro inlines the value and
 * the minifier removes the test-only UI from builds without the flag.
 */

export type DeployEnv = 'production' | 'preview' | 'development';

/** Normalizes EXPO_PUBLIC_DEPLOY_ENV. Anything unrecognized is treated as production. */
export function parseDeployEnv(raw: string | undefined | null): DeployEnv {
  return raw === 'preview' || raw === 'development' ? raw : 'production';
}

export function testUnlockAllowed(
  deployEnvRaw: string | undefined | null,
  flag: string | undefined | null,
  platform: string,
): boolean {
  return platform === 'web' && parseDeployEnv(deployEnvRaw) !== 'production' && flag === '1';
}

/**
 * Temporary production web free unlock (Tim, 2026-11-21, "128 b"): until web
 * payments exist (issue #135), the web paywall may unlock for free on any
 * deploy, production included, when EXPO_PUBLIC_WEB_FREE_UNLOCK is exactly "1".
 * Web only: iOS/Android never get it (they use App Store purchases).
 * Turn it off by deleting the variable from Vercel and redeploying.
 * Callers must also test `process.env.EXPO_PUBLIC_WEB_FREE_UNLOCK === '1'`
 * inline so the minifier drops the free path from builds without the flag.
 */
export function webFreeUnlockAllowed(flag: string | undefined | null, platform: string): boolean {
  return platform === 'web' && flag === '1';
}
