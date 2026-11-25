// Pure helpers for scripts/wyr-testflight.mjs (build the Would You Rather iOS app on EAS, send it to TestFlight).
// Shared pieces (poll, outcome, tail, redaction) come from nevilleRelease.mjs and ascAppsList.mjs; only what differs is here.
export const WYR_APP_ID = '6836653723';
export const WYR_BUNDLE_ID = 'com.timfong888.wouldyourather';
// Only the preview (TestFlight, App Store sandbox purchases) profile. Production builds need Tim's explicit go (docs/ios-build.md).
export const WYR_PROFILE = 'preview';
// Last real TestFlight build when this was written was 22. Never accept a number that goes backwards.
export const WYR_MIN_BUILD = 23;

export function parseWyrEasBuild(stdout) {
  let json;
  try { json = JSON.parse(stdout); } catch { throw new Error('eas build did not return JSON.'); }
  const b = Array.isArray(json) ? json[0] : json;
  if (!b || typeof b !== 'object') throw new Error('eas build returned no build.');
  if (b.status !== 'FINISHED') throw new Error(`EAS build status is ${String(b.status).slice(0, 20)}, not FINISHED.`);
  if (b.platform !== 'IOS') throw new Error('EAS build is not an iOS build.');
  const version = String(b.appVersion ?? '');
  const build = String(b.appBuildVersion ?? '');
  const ipaUrl = String(b.artifacts?.buildUrl ?? '');
  if (!/^\d+(\.\d+){1,2}$/.test(version)) throw new Error('EAS build has no usable app version.');
  if (!/^\d+$/.test(build)) throw new Error('EAS build has no usable numeric build number.');
  if (!/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.ipa$/.test(ipaUrl)) {
    throw new Error('EAS artifact URL is not an https://expo.dev/artifacts/eas/<id>.ipa URL.');
  }
  if (Number(build) < WYR_MIN_BUILD) throw new Error(`Refusing to upload build ${build}: it must be at least ${WYR_MIN_BUILD}.`);
  return { version, build, ipaUrl };
}

export function wyrSummaryMarkdown(build, state, version) {
  return `### Would You Rather iOS build\n\nVersion ${version}, build ${build}: ${state === 'VALID' ? 'processed by Apple, ready in TestFlight' : state}\n\n| Build number | TestFlight processing state |\n| --- | --- |\n| ${build} | ${state} |\n`;
}
