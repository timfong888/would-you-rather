const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');
// Required for posthog-react-native which uses package.json "exports" subpath (e.g. @posthog/core/surveys)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
