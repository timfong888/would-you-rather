#!/usr/bin/env node
/**
 * Build-time guard for RevenueCat keys. Runs as the EAS `eas-build-pre-install`
 * hook (and can be run by hand: EAS_BUILD_PROFILE=production node scripts/check-rc-keys.mjs).
 *
 * A production build must never carry a Test Store key (`test_...`) or a
 * sandbox web key (`rcb_sb_...`), and must carry an App Store key (`appl_...`).
 * A preview build must not carry a Test Store key either: it is meant to
 * exercise the App Store sandbox.
 * No EAS (iOS/Android) build may set EXPO_PUBLIC_TEST_UNLOCK: the free test
 * unlock is web-only (Tim, 2026-11-20, decision A); TestFlight is tested with
 * Apple sandbox purchases.
 */
const profile = process.env.EAS_BUILD_PROFILE ?? process.env.APP_STAGE ?? '';
const ios = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const android = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';
const web = process.env.EXPO_PUBLIC_RC_WEB_KEY ?? '';
const platform = process.env.EAS_BUILD_PLATFORM ?? ''; // 'ios' | 'android' on EAS; empty when run by hand

const problems = [];
if (process.env.EXPO_PUBLIC_TEST_UNLOCK) problems.push(`EXPO_PUBLIC_TEST_UNLOCK is set in the "${profile}" EAS build. The free test unlock is web-only; test iOS with Apple sandbox purchases (docs/payments.md).`);
if (profile === 'production' || profile === 'preview') {
  if (ios.startsWith('test_')) problems.push(`EXPO_PUBLIC_RC_IOS_KEY is a Test Store key (test_...) in a ${profile} build.`);
  if (android.startsWith('test_')) problems.push(`EXPO_PUBLIC_RC_ANDROID_KEY is a Test Store key (test_...) in a ${profile} build.`);
  if (profile === 'production') {
    // Each platform needs its own release key; only check the platform being built.
    if ((platform === 'ios' || platform === '') && !ios.startsWith('appl_')) problems.push('EXPO_PUBLIC_RC_IOS_KEY must be an App Store key (appl_...) in a production iOS build.');
    if (platform === 'android' && !android.startsWith('goog_')) problems.push('EXPO_PUBLIC_RC_ANDROID_KEY must be a Google Play key (goog_...) in a production Android build.');
    if (web.startsWith('test_') || web.startsWith('rcb_sb_')) problems.push('EXPO_PUBLIC_RC_WEB_KEY is a test/sandbox key in a production build.');
    if (process.env.EXPO_PUBLIC_DEPLOY_ENV !== 'production') problems.push('EXPO_PUBLIC_DEPLOY_ENV must be "production" in a production build (eas.json env).');
    if (process.env.EXPO_PUBLIC_OWNER_ACCESS_SHA256) problems.push('EXPO_PUBLIC_OWNER_ACCESS_SHA256 must be unset in the iOS production build (App Store guideline 3.1.1).');
  }
}

if (problems.length) {
  console.error(`RevenueCat key check failed for profile "${profile}":\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`RevenueCat key check passed for profile "${profile || '(none)'}".`);
