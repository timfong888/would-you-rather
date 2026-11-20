// Dynamic layer over app.json (which stays the source of truth).
//
// Builds carrying the free test unlock (EAS profile `preview-test`,
// EXPO_PUBLIC_TEST_UNLOCK=1) get app version 0.0.1. App Store Connect only lets
// you pick a build for an App Store version with the same version string, so a
// test-unlock binary can never be selected for the 1.0.0 release (issue #126,
// review on PR #128). It still installs through TestFlight.
const TEST_UNLOCK_VERSION = '0.0.1';

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_TEST_UNLOCK === '1') {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      throw new Error('EXPO_PUBLIC_TEST_UNLOCK must not be set in a production build.');
    }
    return { ...config, version: TEST_UNLOCK_VERSION };
  }
  return config;
};
