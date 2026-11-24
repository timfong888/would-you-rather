// Pure helpers for the Neville iOS TestFlight workflow (scripts/neville-testflight.mjs).
// No I/O here except through injected functions, so every branch is unit-testable with mocks.
import { join, sep } from 'node:path';

export const SHA_RE = /^[0-9a-f]{40}$/;
export const NEVILLE_BUNDLE_ID = 'pckg.neville';
export const NEVILLE_APP_ID = '6740147041';
// Live version is 1.0 (last build 157). Never produce a build that lands on the live version train.
export const MIN_VERSION = [1, 1, 0];
export const MIN_BUILD = 158;

// Which directory of the neville repo to build. A fixed allowlist, never a path: the workflow input is a choice,
// and this re-checks it in code so no value can reach a filesystem path (no traversal, no absolute paths).
export const NEVILLE_DIRS = ['ios-shell', 'native'];
export function validateNevilleDir(name) {
  if (typeof name !== 'string' || !NEVILLE_DIRS.includes(name)) {
    throw new Error(`neville_dir must be one of: ${NEVILLE_DIRS.join(', ')}.`); // never echo the offending value
  }
  return name;
}
export function resolveNevilleDir(root, name) {
  if (typeof root !== 'string' || !root) throw new Error('NEVILLE_ROOT is not set.');
  return join(root, validateNevilleDir(name));
}

// The chosen dir must be a real directory (not a symlink) whose realpath is inside the realpath of the root.
// Returns a list of fixed-text errors (never echoes paths). `fs` is injected for tests.
export function checkDirSafety(root, name, fs) {
  const errors = [];
  try {
    const dir = join(root, validateNevilleDir(name));
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink()) errors.push(`${name} is a symlink`);
    else if (!st.isDirectory()) errors.push(`${name} is not a directory`);
    const real = fs.realpathSync(dir), realRoot = fs.realpathSync(root);
    if (!real.startsWith(realRoot + sep)) errors.push(`${name} resolves outside the neville checkout`);
  } catch (e) {
    errors.push(/neville_dir/.test(e.message) ? e.message : `${name} is missing or unreadable`);
  }
  return errors;
}

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

// Retry a network call that may throw (DNS, reset, timeout: `fetch failed`). Backoff doubles from baseMs; the last error is rethrown.
export async function withRetry(fn, { attempts = 3, baseMs = 2000, sleep }) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < attempts) await sleep(baseMs * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

// Poll GET /v1/builds for this one build. Returns { state, polls }. Only build number and state leave this function.
// A GET that throws (network error) is tried up to 3 times with backoff; if it still fails that poll counts as FETCH_ERROR and polling goes on.
// After maxNetFails consecutive such polls it gives up (a sustained outage must end in the warning well before the job timeout).
export async function pollBuild(get, { appId = NEVILLE_APP_ID, build, version, sleep, maxPolls = 60, intervalMs = 30000, retryBaseMs = 2000, maxNetFails = 3 }) {
  let netFails = 0;
  let state = 'NOT_FOUND'; // last real answer from Apple
  let sawOk = false;
  let httpState = '';
  for (let i = 1; i <= maxPolls; i++) {
    const q = `/v1/builds?filter[app]=${appId}&filter[version]=${encodeURIComponent(build)}` +
      `&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&limit=1&fields[builds]=version,processingState`;
    let r;
    try { r = await withRetry(() => get(q), { sleep, baseMs: retryBaseMs }); } catch { r = { status: 'FETCH_ERROR', body: {} }; }
    netFails = r.status === 'FETCH_ERROR' ? netFails + 1 : 0;
    if (r.status === 'FETCH_ERROR') {
      // Only when Apple never answered with an HTTP status: a network error must not hide an earlier 5xx/429 (which stays red).
      if (!httpState) httpState = 'FETCH_ERROR';
    } else if (r.status === 200) {
      sawOk = true;
      const row = (r.body?.data || [])[0];
      state = row?.attributes?.processingState || 'NOT_FOUND';
      if (['VALID', 'FAILED', 'INVALID'].includes(state)) return { state, polls: i };
    } else {
      httpState = `HTTP_${r.status}`;
      // A revoked or under-scoped key will not recover: stop now instead of retrying for 30 minutes.
      if (r.status === 401 || r.status === 403) return { state: httpState, polls: i };
    }
    // Giving up on a network outage: an earlier 200 with no build row (NOT_FOUND, Apple still indexing) is not a real answer, so it does not outrank the outage.
    if (netFails >= maxNetFails) return { state: sawOk && state !== 'NOT_FOUND' ? state : (httpState || state), polls: i };
    if (i < maxPolls) await sleep(intervalMs);
  }
  // A transient 5xx or 429 on the last poll must not hide a real processing state seen earlier.
  return { state: sawOk ? state : (httpState || state), polls: maxPolls };
}

export function summaryMarkdown(build, state, version, dir) {
  const v = version ? `Version ${version}, build ${build}` : `Build ${build}`;
  const d = dir === undefined ? '' : `Directory: \`${validateNevilleDir(dir)}\`\n\n`;
  return `### Neville iOS build\n\n${d}${v}: ${state === 'VALID' ? 'processed by Apple, ready in TestFlight' : state}\n\n| Build number | TestFlight processing state |\n| --- | --- |\n| ${build} | ${state} |\n`;
}

// Secretless check that the chosen neville directory builds on its own. Reads files only; prints no file content
// (only fixed text and line numbers), so nothing from neville can start a workflow command in the log.
// Returns { lines, warnings, errors }. `fs` is injected for tests.
export const MAX_CHECK_FILE_BYTES = 256 * 1024;
export const MAX_CHECK_LINE = 2000;
// Files that change what `npm ci`/EAS resolve or run at config time. Not allowed in either dir; an explicit decision would be needed.
export const FORBIDDEN_FILES = ['.npmrc', '.yarnrc', '.yarnrc.yml', 'app.config.js', 'app.config.ts'];
// Expo SDK 58 (eas-cli and Metro) needs Node >= 22.13; native/ is built on Node 22.
export const NATIVE_MIN_NODE = [22, 13, 0];
export function checkSelfContained(dir, name, { fs, root, nodeVersion = process.versions.node, profile = 'production', gitRoot = '' }) {
  validateNevilleDir(name);
  const lines = [], warnings = [], errors = [];
  if (root) errors.push(...checkDirSafety(root, name, fs));
  // Any symlink among the files we read (or a forbidden config file of any kind) fails closed.
  for (const f of ['package.json', 'eas.json', 'app.json', 'metro.config.js', ...FORBIDDEN_FILES]) {
    let st; try { st = fs.lstatSync(join(dir, f)); } catch { continue; }
    if (st.isSymbolicLink()) errors.push(`${name}/${f} is a symlink`);
  }
  let present = [];
  try { present = fs.readdirSync(dir); } catch { /* reported by the required-file checks */ }
  for (const f of present.filter((n) => FORBIDDEN_FILES.includes(n) || n.startsWith('.yarnrc'))) {
    errors.push(`${name}/${FORBIDDEN_FILES.includes(f) ? f : '.yarnrc*'} is present and not allowed (changes install/config resolution)`);
  }
  const has = (f) => fs.existsSync(join(dir, f));
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(join(dir, f), 'utf8')); } catch { return undefined; } };
  const required = name === 'native' ? ['package.json', 'app.json', 'eas.json'] : ['package.json', 'eas.json'];
  for (const f of required) { if (!has(f)) errors.push(`${name}/${f} is missing`); }
  lines.push(`directory: ${name}`);
  if (gitRoot) lines.push(`git root: ${gitRoot}`);

  if (name === 'native') {
    lines.push('native: Expo SDK 58 requires Node >= 22.13 (eas-cli and Metro); the workflow runs native on Node 22');
    if (!versionAtLeast(nodeVersion, NATIVE_MIN_NODE)) errors.push(`this runner's Node is older than ${NATIVE_MIN_NODE.slice(0, 2).join('.')}; native needs Node >= 22.13`);
    else lines.push('runner Node satisfies >= 22.13');
    if (!has('package-lock.json')) errors.push('native/package-lock.json is missing (native installs with npm ci)');
  }
  const pkg = has('package.json') ? readJson('package.json') : undefined;
  if (has('package.json') && !pkg) errors.push(`${name}/package.json is not valid JSON`);
  const eng = pkg?.engines?.node;
  if (typeof eng === 'string') lines.push(`${name}/package.json engines.node: ${eng.replace(/[^0-9A-Za-z.<>=^~| *-]/g, '?').slice(0, 40)}`);
  if (pkg?.workspaces) warnings.push(`${name}/package.json declares workspaces`); else if (pkg) lines.push(`no workspaces in ${name}/package.json`);
  if (name === 'native' && pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    const up = Object.entries(deps).filter(([, v]) => /^(file|link|portal):\.\.|^workspace:/.test(String(v))).map(([k]) => k);
    if (up.length) errors.push(`native/package.json depends on a parent path or workspace (${up.length} package(s)); native must not depend on parent files`);
    else lines.push('no parent or workspace dependencies in native/package.json');
  }

  if (has('metro.config.js')) {
    const raw = fs.statSync(join(dir, 'metro.config.js')).size > MAX_CHECK_FILE_BYTES ? undefined : fs.readFileSync(join(dir, 'metro.config.js'), 'utf8');
    const src = raw === undefined ? [] : raw.split(/\r\n|\r|\n/);
    if (raw === undefined) errors.push(`${name}/metro.config.js is larger than ${MAX_CHECK_FILE_BYTES} bytes; not scanned`);
    else if (src.some((l) => l.length > MAX_CHECK_LINE)) { errors.push(`${name}/metro.config.js has a line longer than ${MAX_CHECK_LINE} characters; not scanned`); src.length = 0; }
    const parent = []; const ws = [];
    src.forEach((l, i) => {
      if (/(\.\.\/|__dirname *\+ *['"]\/\.\.|path\.(resolve|join)\([^)]*['"]\.\.['"])/.test(l)) parent.push(i + 1);
      if (/workspaces?|workspaceRoot|monorepo/i.test(l)) ws.push(i + 1);
    });
    lines.push(`${name}/metro.config.js: present`);
    if (parent.length) warnings.push(`${name}/metro.config.js references a parent directory (line ${parent.slice(0, 5).join(', ')})`); else lines.push('metro.config.js: no parent-directory references');
    if (ws.length) warnings.push(`${name}/metro.config.js mentions workspaces (line ${ws.slice(0, 5).join(', ')})`); else lines.push('metro.config.js: no workspaces references');
  } else lines.push(`${name}/metro.config.js: absent (Expo defaults)`);

  if (has('../package.json') || fs.existsSync(join(dir, '..', 'package.json'))) {
    let top; try { top = JSON.parse(fs.readFileSync(join(dir, '..', 'package.json'), 'utf8')); } catch { /* ignore */ }
    if (top?.workspaces) warnings.push('neville/package.json declares workspaces'); else lines.push('no workspaces in neville/package.json');
  } else lines.push('neville/package.json: absent');

  const eas = has('eas.json') ? readJson('eas.json') : undefined;
  if (has('eas.json') && !eas) errors.push(`${name}/eas.json is not valid JSON`);
  if (eas) {
    if (!eas.build?.[profile]) errors.push(`${name}/eas.json has no build profile "${profile}"`); else lines.push(`eas profile "${profile}": present`);
    lines.push(`eas appVersionSource: ${String(eas.cli?.appVersionSource ?? 'unset').slice(0, 20).replace(/[^A-Za-z]/g, '')}`);
  }
  const app = has('app.json') ? readJson('app.json') : undefined;
  if (has('app.json') && !app) errors.push(`${name}/app.json is not valid JSON`);
  if (app) {
    const bid = app.expo?.ios?.bundleIdentifier;
    if (bid === NEVILLE_BUNDLE_ID) lines.push(`app.json ios bundle id: ${NEVILLE_BUNDLE_ID}`);
    else if (name === 'native') errors.push(`native/app.json ios.bundleIdentifier is not ${NEVILLE_BUNDLE_ID}`);
    else warnings.push(`${name}/app.json ios.bundleIdentifier is not ${NEVILLE_BUNDLE_ID}`);
  }
  return { lines, warnings, errors };
}

// Keep a failing child's output short and secret-free before it reaches the public log. Same order as tailLines:
// redact the whole text, replace URLs, then filter/slice/truncate and prefix every line with `| `.
export function tailErrors(text, redact, max = 15) {
  const safe = redact(String(text)).replace(/https?:\/\/\S+/g, '<url>');
  return safe.split(/\r\n|\r|\n/).filter((l) => /error|fail|denied|not found|invalid/i.test(l))
    .slice(-max).map((l) => `| ${l.slice(0, 300)}`).join('\n');
}

// Last lines of a failing child's output for the public log. Order matters:
// 1) redact the WHOLE text first, so a multi-line secret (a PEM key) is matched before it is split into lines;
// 2) replace URLs, which may carry signed tokens;
// 3) split on every line break the Actions runner honours (\r\n, a lone \r, \n), drop blanks, keep the last `max`, truncate each line to 300 chars;
// 4) prefix every line with `| ` (NOT whitespace: the Actions runner trims leading whitespace before looking for `::`),
//    so no printed line can be parsed as a workflow command.
export function tailLines(text, redact, max = 60) {
  const safe = redact(String(text)).replace(/https?:\/\/\S+/g, '<url>');
  return safe.split(/\r\n|\r|\n/).filter((l) => l.trim()).slice(-max).map((l) => `| ${l.slice(0, 300)}`).join('\n');
}

// How the run ends once polling stops. Only a build Apple is still working on is a green notice;
// a build that never appeared or a failing GET (revoked or under-scoped key) must not end green.
// uploadComplete: Apple already reported the upload COMPLETE. Then a status check that never got an answer (network error)
// is only a warning: the build was delivered. Any real Apple answer (FAILED, INVALID, NOT_FOUND, HTTP error) still fails.
export function finalOutcome(state, { uploadComplete = false } = {}) {
  if (state === 'FETCH_ERROR' && uploadComplete) return { exitCode: 0, kind: 'unverified' };
  if (state === 'VALID') return { exitCode: 0, kind: 'valid' };
  if (state === 'PROCESSING') return { exitCode: 0, kind: 'still-processing' };
  if (state === 'FAILED' || state === 'INVALID') return { exitCode: 1, kind: 'rejected' };
  if (state === 'NOT_FOUND') return { exitCode: 1, kind: 'not-found' };
  return { exitCode: 1, kind: 'unknown' };
}
