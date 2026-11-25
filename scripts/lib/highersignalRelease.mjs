// Pure helpers for the Higher Signal iOS TestFlight workflow (scripts/highersignal-testflight.mjs).
// Generic helpers are imported from the Neville library (unchanged). Neville's live-version guard does not apply: this is a new app.
import { join, sep } from 'node:path';
import { versionAtLeast, isParentDep } from './nevilleRelease.mjs';

export { validateSha, pollBuild, finalOutcome, tailLines, tailErrors } from './nevilleRelease.mjs';

export const HIGHERSIGNAL_REPO = 'timfong888/highersignal';
export const HIGHERSIGNAL_BUNDLE_ID = 'pckg.highersignal';
export const APP_ID_RE = /^[0-9]{8,12}$/;
// Where the Expo app lives in the repo. Never an input; the workflow hardcodes one of these. '.' is the repo root.
export const HIGHERSIGNAL_DIRS = ['.', 'native'];
export const MIN_NODE = [22, 13, 0];

export function validateAppId(id) {
  if (typeof id !== 'string' || !APP_ID_RE.test(id)) {
    throw new Error('HIGHERSIGNAL_APP_ID is not set to a numeric ASC app id. Create the app record in App Store Connect, then put its id in the workflow env.');
  }
  return id;
}
export function validateDir(name) {
  if (typeof name !== 'string' || !HIGHERSIGNAL_DIRS.includes(name)) throw new Error(`HIGHERSIGNAL_SUBDIR must be one of: ${HIGHERSIGNAL_DIRS.join(', ')}.`);
  return name;
}
export function resolveDir(root, name) {
  if (typeof root !== 'string' || !root) throw new Error('HIGHERSIGNAL_ROOT is not set.');
  return validateDir(name) === '.' ? root : join(root, name);
}

// The build dir must be a real directory (not a symlink) whose realpath stays inside the checkout. Fixed-text errors only.
export function checkDirSafety(root, name, fs) {
  const errors = [];
  try {
    const dir = resolveDir(root, name);
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink()) errors.push(`${name} is a symlink`);
    else if (!st.isDirectory()) errors.push(`${name} is not a directory`);
    const real = fs.realpathSync(dir), realRoot = fs.realpathSync(root);
    if (real !== realRoot && !real.startsWith(realRoot + sep)) errors.push(`${name} resolves outside the checkout`);
  } catch (e) {
    errors.push(/HIGHERSIGNAL_SUBDIR/.test(e.message) ? e.message : `${name} is missing or unreadable`);
  }
  return errors;
}

export function parseEasBuild(stdout) {
  let json;
  try { json = JSON.parse(stdout); } catch { throw new Error('eas build did not return JSON.'); }
  const b = Array.isArray(json) ? json[0] : json;
  if (!b || typeof b !== 'object') throw new Error('eas build returned no build.');
  if (b.status !== 'FINISHED') throw new Error(`EAS build status is ${String(b.status).slice(0, 20)}, not FINISHED.`);
  if (b.platform !== 'IOS') throw new Error('EAS build is not an iOS build.');
  const version = String(b.appVersion ?? ''), build = String(b.appBuildVersion ?? ''), ipaUrl = String(b.artifacts?.buildUrl ?? '');
  if (!/^\d+(\.\d+){1,2}$/.test(version)) throw new Error('EAS build has no usable app version.');
  if (!/^\d+$/.test(build)) throw new Error('EAS build has no usable numeric build number.');
  if (!/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.ipa$/.test(ipaUrl)) throw new Error('EAS artifact URL is not an https://expo.dev/artifacts/eas/<id>.ipa URL.');
  return { version, build, ipaUrl };
}

// GET /v1/apps/<id> must be the Higher Signal app before anything is built or uploaded. Prints nothing about the app.
export async function preflightApp(get, appId, { bundleId = HIGHERSIGNAL_BUNDLE_ID } = {}) {
  const r = await get(`/v1/apps/${validateAppId(appId)}?fields[apps]=bundleId`);
  if (r.status !== 200) throw new Error(`App Store Connect app lookup failed (HTTP ${r.status}).`);
  if (r.body?.data?.attributes?.bundleId !== bundleId) throw new Error('The configured ASC app id does not belong to the Higher Signal bundle id. Aborting before any build or upload.');
}

export function summaryMarkdown(build, state, version) {
  return `### Higher Signal iOS build\n\nVersion ${version}, build ${build}: ${state === 'VALID' ? 'processed by Apple, ready in TestFlight' : state}\n\n| Build number | TestFlight processing state |\n| --- | --- |\n| ${build} | ${state} |\n`;
}

// Files that change what `npm ci` / eas-cli resolve or run at config time. Same list as the WYR check. Only plain metro.config.js and babel.config.js are allowed.
export const FORBIDDEN_PATTERNS = [
  [/^app\.config\./, 'app.config.*'], [/^\.npmrc/, '.npmrc*'], [/^\.yarnrc/, '.yarnrc*'], [/^\.env($|\.)/, '.env*'],
  [/^fingerprint\.config\./, 'fingerprint.config.*'], [/^credentials\.json$/, 'credentials.json'],
  [/^babel\.config\.(?!js$)/, 'babel.config.* other than babel.config.js'], [/^\.babelrc/, '.babelrc*'],
  [/^metro\.config\.(?!js$)/, 'metro.config.* other than metro.config.js'],
];
const METRO_PARENT_RE = /(\.\.\/|__dirname *\+ *['"]\/\.\.|path\.(resolve|join)\([^)]*['"]\.\.['"]|path\.dirname\(\s*__dirname)/;
const MAX_FILE = 256 * 1024;

// Secretless check that the build dir builds on its own. Reads files only; prints fixed text and line numbers, never file content.
// Returns { lines, warnings, errors }. `fs` is injected for tests.
export function checkSelfContained(dir, name, { fs, root, nodeVersion = process.versions.node, profile = 'production' }) {
  validateDir(name);
  const lines = [], warnings = [], errors = [];
  if (root) errors.push(...checkDirSafety(root, name, fs));
  const label = name === '.' ? 'repo root' : name;
  for (const f of ['package.json', 'package-lock.json', 'eas.json', 'app.json', 'metro.config.js', 'babel.config.js']) {
    let st; try { st = fs.lstatSync(join(dir, f)); } catch { continue; }
    if (st.isSymbolicLink()) errors.push(`${label}/${f} is a symlink`);
  }
  let present = []; try { present = fs.readdirSync(dir); } catch { /* reported below */ }
  const seen = new Set();
  for (const n of present) for (const [re, l] of FORBIDDEN_PATTERNS) if (re.test(n)) seen.add(l);
  for (const l of seen) errors.push(`${label}/${l} is present and not allowed (changes install/config resolution)`);
  const has = (f) => fs.existsSync(join(dir, f));
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(join(dir, f), 'utf8')); } catch { return undefined; } };
  for (const f of ['package.json', 'package-lock.json', 'app.json', 'eas.json']) if (!has(f)) errors.push(`${label}/${f} is missing`);
  lines.push(`directory: ${label}`);
  if (!versionAtLeast(nodeVersion, MIN_NODE)) errors.push(`this runner's Node is older than 22.13; Expo SDK 58 needs Node >= 22.13`); else lines.push('runner Node satisfies >= 22.13');

  const lock = has('package-lock.json') ? readJson('package-lock.json') : undefined;
  if (has('package-lock.json') && !lock) errors.push(`${label}/package-lock.json is not valid JSON`);
  if (lock) { // lockfile v3, every resolved URL on the npm registry, no links or local-path packages
    if (lock.lockfileVersion !== 3) errors.push('package-lock.json is not lockfileVersion 3');
    if (lock.dependencies) errors.push('package-lock.json has a legacy dependencies tree');
    let bad = 0, links = 0, local = 0;
    for (const [k, v] of Object.entries(lock.packages || {})) {
      if (!v || typeof v !== 'object') continue;
      if (v.link) links++;
      if (k !== '' && !k.includes('node_modules') && !v.link) local++;
      if (typeof v.resolved === 'string' && !/^https:\/\/registry\.npmjs\.org\//.test(v.resolved)) bad++;
    }
    if (bad) errors.push(`package-lock.json has ${bad} resolved URL(s) outside https://registry.npmjs.org/`);
    if (links) errors.push(`package-lock.json has ${links} link entr(y/ies)`);
    if (local) errors.push(`package-lock.json has ${local} package(s) installed from a local path`);
    if (!bad && !links && !local && lock.lockfileVersion === 3) lines.push('package-lock.json: registry URLs only, no links');
  }
  const pkg = has('package.json') ? readJson('package.json') : undefined;
  if (has('package.json') && !pkg) errors.push(`${label}/package.json is not valid JSON`);
  if (pkg) {
    if (pkg.workspaces) errors.push(`${label}/package.json declares workspaces`); else lines.push('no workspaces in package.json');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
    const up = Object.entries(deps).filter(([, v]) => isParentDep(v)).map(([k]) => k);
    if (up.length) errors.push(`${label}/package.json depends on a parent path or workspace (${up.length} package(s))`); else lines.push('no parent or workspace dependencies');
  }
  if (has('metro.config.js')) {
    const big = fs.statSync(join(dir, 'metro.config.js')).size > MAX_FILE;
    if (big) errors.push(`${label}/metro.config.js is larger than ${MAX_FILE} bytes; not scanned`);
    else {
      const hits = fs.readFileSync(join(dir, 'metro.config.js'), 'utf8').split(/\r\n|\r|\n/).map((l, i) => (l.length > 2000 || METRO_PARENT_RE.test(l) ? i + 1 : 0)).filter(Boolean);
      if (hits.length) errors.push(`${label}/metro.config.js references a parent directory or has an unscannable line (line ${hits.slice(0, 5).join(', ')})`);
      else lines.push('metro.config.js: no parent-directory references');
    }
  }
  const eas = has('eas.json') ? readJson('eas.json') : undefined;
  if (has('eas.json') && !eas) errors.push(`${label}/eas.json is not valid JSON`);
  if (eas) {
    if (!eas.build?.[profile]) errors.push(`${label}/eas.json has no build profile "${profile}"`); else lines.push(`eas profile "${profile}": present`);
    const src = eas.cli?.appVersionSource;
    lines.push(`eas appVersionSource: ${String(src ?? 'unset').slice(0, 20).replace(/[^A-Za-z]/g, '')}`);
    if (!(src === 'remote' && eas.build?.[profile]?.autoIncrement) ) warnings.push(`eas.json should set cli.appVersionSource "remote" and build.${profile}.autoIncrement so build numbers rise on their own`);
  }
  const app = has('app.json') ? readJson('app.json') : undefined;
  if (has('app.json') && !app) errors.push(`${label}/app.json is not valid JSON`);
  if (app) {
    const exp = app.expo ?? app;
    const plugins = Array.isArray(exp.plugins) ? exp.plugins : [];
    const local = plugins.filter((p) => { const n = Array.isArray(p) ? p[0] : p; return typeof n !== 'string' || /^(\.|\/|\\|~|[A-Za-z]:|(file|link|portal):)/i.test(n.trim()) || n.includes('..'); });
    if (local.length) errors.push(`${label}/app.json lists ${local.length} plugin(s) that are local files or paths; only package-name plugins are allowed`); else lines.push('app.json plugins: package names only');
    if (exp.ios?.bundleIdentifier === HIGHERSIGNAL_BUNDLE_ID) lines.push(`app.json ios bundle id: ${HIGHERSIGNAL_BUNDLE_ID}`);
    else errors.push(`${label}/app.json ios.bundleIdentifier is not ${HIGHERSIGNAL_BUNDLE_ID}`);
    if (!exp.extra?.eas?.projectId) warnings.push('app.json has no extra.eas.projectId; run `eas init` once so EAS knows the project');
  }
  return { lines, warnings, errors };
}
