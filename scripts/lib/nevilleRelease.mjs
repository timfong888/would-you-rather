// Pure helpers for the Neville iOS TestFlight workflow (scripts/neville-testflight.mjs).
// No I/O here except through injected functions, so every branch is unit-testable with mocks.

export const SHA_RE = /^[0-9a-f]{40}$/;
export const NEVILLE_BUNDLE_ID = 'pckg.neville';
export const NEVILLE_APP_ID = '6740147041';
// Live version is 1.0 (last build 157). Never produce a build that lands on the live version train.
export const MIN_VERSION = [1, 1, 0];
export const MIN_BUILD = 158;

export function validateSha(sha) {
  if (typeof sha !== 'string' || !SHA_RE.test(sha)) {
    throw new Error('neville_sha must be a full 40-character lowercase hex commit sha.');
  }
  return sha;
}

const versionParts = (v) => String(v).split('.').map(Number);
export function versionAtLeast(version, min) {
  const a = versionParts(version);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0, y = min[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

// Pull the one finished iOS build out of `eas build --json` output and validate every field we later
// pass to Apple or fetch from. Nothing from here is printed except version and build number.
export function parseEasBuild(stdout) {
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
  if (!versionAtLeast(version, MIN_VERSION)) {
    throw new Error(`Refusing to upload version ${version}: it must be at least ${MIN_VERSION.join('.')} so the live 1.0 version is untouched.`);
  }
  if (Number(build) < MIN_BUILD) {
    throw new Error(`Refusing to upload build ${build}: it must be at least ${MIN_BUILD} (live last build is 157).`);
  }
  return { version, build, ipaUrl };
}

// GET /v1/apps/<id> must be the Neville app (matching bundle id) before anything is built or uploaded.
// Prints nothing about the app; only pass or throw.
export async function preflightApp(get, { appId = NEVILLE_APP_ID, bundleId = NEVILLE_BUNDLE_ID } = {}) {
  const r = await get(`/v1/apps/${appId}?fields[apps]=bundleId`);
  if (r.status !== 200) throw new Error(`App Store Connect app lookup failed (HTTP ${r.status}).`);
  if (r.body?.data?.attributes?.bundleId !== bundleId) {
    throw new Error('The configured ASC app id does not belong to the Neville bundle id. Aborting before any build or upload.');
  }
}

// Poll GET /v1/builds for this one build. Returns { state, polls }. Only build number and state leave this function.
export async function pollBuild(get, { appId = NEVILLE_APP_ID, build, version, sleep, maxPolls = 60, intervalMs = 30000 }) {
  let state = 'NOT_FOUND';
  for (let i = 1; i <= maxPolls; i++) {
    const q = `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(build)}` +
      `&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&limit=1&fields[builds]=version,processingState`;
    const r = await get(q);
    if (r.status === 200) {
      const row = (r.body?.data || [])[0];
      state = row?.attributes?.processingState || 'NOT_FOUND';
      if (['VALID', 'FAILED', 'INVALID'].includes(state)) return { state, polls: i };
    } else {
      state = `HTTP_${r.status}`;
    }
    if (i < maxPolls) await sleep(intervalMs);
  }
  return { state, polls: maxPolls };
}

export function summaryMarkdown(build, state) {
  return `### Neville iOS build\n\n| Build number | TestFlight processing state |\n| --- | --- |\n| ${build} | ${state} |\n`;
}

// Keep a failing child's output short and secret-free before it reaches the public log.
export function tailErrors(text, redact, max = 15) {
  return String(text).split(/\r?\n/).filter((l) => /error|fail|denied|not found|invalid/i.test(l))
    .slice(-max).map((l) => redact(l).slice(0, 300)).join('\n');
}

// How the run ends once polling stops. Only a build Apple is still working on is a green notice;
// a build that never appeared or a failing GET (revoked or under-scoped key) must not end green.
export function finalOutcome(state) {
  if (state === 'VALID') return { exitCode: 0, kind: 'valid' };
  if (state === 'PROCESSING') return { exitCode: 0, kind: 'still-processing' };
  if (state === 'FAILED' || state === 'INVALID') return { exitCode: 1, kind: 'rejected' };
  if (state === 'NOT_FOUND') return { exitCode: 1, kind: 'not-found' };
  return { exitCode: 1, kind: 'unknown' };
}
