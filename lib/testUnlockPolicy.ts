/**
 * Deploy environment and the one remaining free unlock. Pure, so it is unit-tested.
 *
 * The preview/dev free "test unlock" (simulated checkout, EXPO_PUBLIC_TEST_UNLOCK)
 * is gone (Tim, 2026-11-21, "Test Store yes"): previews and local web builds test
 * the real purchase flow against RevenueCat's Test Store instead (a `test_` web
 * key, see lib/purchases-web-core.ts), which never charges. Any build that still
 * sets EXPO_PUBLIC_TEST_UNLOCK fails (scripts/check-web-build.mjs, check-rc-keys.mjs).
 *
 * The deploy environment comes from EXPO_PUBLIC_DEPLOY_ENV, set by
 * `npm run build:web` from Vercel's VERCEL_ENV and by the `env` block of each
 * profile in eas.json. An unknown or missing value counts as production (fail closed).
 */

export type DeployEnv = 'production' | 'preview' | 'development';

/** Normalizes EXPO_PUBLIC_DEPLOY_ENV. Anything unrecognized is treated as production. */
export function parseDeployEnv(raw: string | undefined | null): DeployEnv {
  return raw === 'preview' || raw === 'development' ? raw : 'production';
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
