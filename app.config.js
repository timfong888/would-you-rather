// Dynamic layer over app.json (which stays the source of truth).
//
// Builds carrying the free test unlock (EAS profile `preview-test`,
// EXPO_PUBLIC_TEST_UNLOCK=1) get app version 99.<major>.<minor> of the real
// version (1.0.0 -> 99.1.0). Why (issue #126, review on PR #128):
// - App Store Connect only lets you pick a build for an App Store version with
//   the same version string, so a test-unlock binary can never be selected for
//   a real release (1.x, 2.x, ...).
// - It stays higher than any approved release, so uploads keep working after
//   launch (Apple rejects uploads below the last approved version, ITMS-90062).
// Test builds go to internal TestFlight testers only; never create an App Store
// version 99.x.
const testUnlockVersion = (version) => {
  const [major = '1', minor = '0'] = String(version ?? '1.0.0').split('.');
  return `99.${major}.${minor}`;
};

module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_TEST_UNLOCK === '1') {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      throw new Error('EXPO_PUBLIC_TEST_UNLOCK must not be set in a production build.');
    }
    return { ...config, version: testUnlockVersion(config.version) };
  }
  return config;
};

module.exports.testUnlockVersion = testUnlockVersion;
