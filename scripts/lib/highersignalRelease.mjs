// Pure helpers for the Higher Signal iOS TestFlight workflow (scripts/highersignal-testflight.mjs).
// Generic helpers are imported from the Neville library (unchanged). Neville's live-version guard does not apply: this is a new app.
import { join, sep } from 'node:path';
import { versionAtLeast } from './nevilleRelease.mjs';
import { isLocalPlugin, pluginPackage, isNonRegistrySpec, parseBuildVersionGet, checkNextBuildNumber } from './wyrRelease.mjs'; // shared plugin and dependency-spec rules, same as the WYR check

export { validateSha, pollBuild, finalOutcome, tailLines, tailErrors } from './nevilleRelease.mjs';

export const HIGHERSIGNAL_REPO = 'timfong888/highersignal';
export const HIGHERSIGNAL_BUNDLE_ID = 'sophia.pkg';
export const APP_ID_RE = /^[0-9]{8,12}$/;
// Where the Expo app lives in the repo (app/, with its own package.json, app.json, eas.json). Never an input; the only allowed value.
export const HIGHERSIGNAL_DIRS = ['app'];
export const MIN_NODE = [22, 13, 0];

// Floor guard for the reused Sophia app: the build must be on a version ABOVE the highest released version, and its build number
// ABOVE the highest build Apple has. Both come from workflow env constants (reviewed in a PR, never a dispatch input, so a dispatch
// cannot lower them). Empty means "not set yet": every check refuses.
export const VERSION_RE = /^\d+\.\d+\.\d+$/;
export function validateFloors(minVersion, minBuild) {
  if (typeof minVersion !== 'string' || !VERSION_RE.test(minVersion) || typeof minBuild !== 'string' || !/^\d{1,9}$/.test(minBuild)) {
    throw new Error('HIGHERSIGNAL_MIN_VERSION (x.y.z) and HIGHERSIGNAL_MIN_BUILD (digits) are not set. Put the highest released version and highest build number of the ASC app in the workflow env.');
  }
  return { minVersion, minBuild };
}
const vparts = (v) => String(v).split('.').map(Number);
export function versionAbove(version, floor) {
  const a = vparts(version), b = vparts(floor);
  for (let i = 0; i < 3; i++) { const x = a[i] ?? 0, y = b[i] ?? 0; if (x !== y) return x > y; }
  return false; // equal is not above
}

export { parseBuildVersionGet };
// Pre-build: the next EAS remote build number (current + 1) must be strictly above the floor. Returns that number or throws before any build.
export function checkNextBuild(current, minBuild) { return checkNextBuildNumber(current, Number(minBuild) + 1); }

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
  return join(root, validateDir(name));
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
    if (!real.startsWith(realRoot + sep)) errors.push(`${name} resolves outside the checkout`);
  } catch (e) {
    errors.push(/HIGHERSIGNAL_SUBDIR/.test(e.message) ? e.message : `${name} is missing or unreadable`);
  }
  return errors;
}

export function parseEasBuild(stdout, floors) {
  const { minVersion, minBuild } = validateFloors(floors?.minVersion, floors?.minBuild);
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
  if (!versionAbove(version, minVersion)) throw new Error(`Refusing to upload version ${version}: it must be above the released version ${minVersion}.`);
  if (!(Number(build) > Number(minBuild))) throw new Error(`Refusing to upload build ${build}: it must be above the highest existing build ${minBuild}.`);
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

// This file imports helpers from nevilleRelease.mjs and wyrRelease.mjs: a change to those changes this check too.
// Files that change what `npm ci` / eas-cli resolve or run at config time. Same list as the WYR check. Only plain metro.config.js and babel.config.js are allowed.
export const FORBIDDEN_PATTERNS = [
  [/^app\.config\./, 'app.config.*'], [/^\.npmrc/, '.npmrc*'], [/^\.yarnrc/, '.yarnrc*'], [/^\.env($|\.)/, '.env*'],
  [/^fingerprint\.config\./, 'fingerprint.config.*'], [/^credentials\.json$/, 'credentials.json'],
  [/^babel\.config\.(?!js$)/, 'babel.config.* other than babel.config.js'], [/^\.babelrc/, '.babelrc*'],
  [/^metro\.config\.(?!js$)/, 'metro.config.* other than metro.config.js'],
];
const METRO_PARENT_RE = /(\.\.\/|__dirname *\+ *['"]\/\.\.|path\.(resolve|join)\([^)]*['"]\.\.['"]|path\.dirname\(\s*__dirname)/;
const ROOT_CONFIG_LABELS = ['.npmrc*', '.yarnrc*', '.env*'];
const MAX_FILES = 20000, MAX_JSON = 20 * 1024 * 1024, MAX_CFG = 256 * 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const hasKey = (o, keys) => o && typeof o === 'object' && (Object.keys(o).some((k) => keys.includes(k)) || Object.values(o).some((v) => hasKey(v, keys)));
const stringsOf = (o) => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(stringsOf) : []);

// Secretless check that the build dir builds on its own and cannot run repo code inside eas-cli's reach. Reads files only; prints fixed
// text and line numbers, never file content. It is a blocklist, not a proof: the real control is that the sha is merged on main.
// Returns { lines, warnings, errors }. `fs` is injected for tests. `appId` (optional): the configured ASC app id, checked against eas.json submit.
/** @param {string} dir @param {string} name @param {{ fs: any, root?: string, nodeVersion?: string, profile?: string, appId?: string, minVersion?: string }} opts */
export function checkSelfContained(dir, name, { fs, root, nodeVersion = process.versions.node, profile = 'production', appId, minVersion }) {
  validateDir(name);
  const lines = [], warnings = [], errors = [];
  if (root) errors.push(...checkDirSafety(root, name, fs));
  const label = name;
  lines.push(`directory: ${label}`);

  // 1. No symlink anywhere in the tree (it could point a config file, plugin or packed asset outside the clone). Bounded walk.
  const links = []; let count = 0, truncated = false;
  const walk = (d) => {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (truncated) return;
      const full = join(d, e.name);
      if (++count > MAX_FILES) { truncated = true; return; }
      let l; try { l = fs.lstatSync(full); } catch { continue; }
      if (l.isSymbolicLink()) { links.push(full.slice(dir.length + 1)); continue; }
      if (l.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full);
    }
  };
  walk(dir);
  if (truncated) errors.push(`${label} has more than ${MAX_FILES} entries; not scanned`);
  if (links.length) errors.push(`${label} contains ${links.length} symlink(s) (first: ${links.slice(0, 3).map((x) => x.replace(/[^A-Za-z0-9_./@-]/g, '?').slice(0, 80)).join(', ')})`);
  else lines.push('no symlinks in the tree');

  // 2. Files that change what npm or eas-cli resolve, load or run.
  let present = []; try { present = fs.readdirSync(dir); } catch { /* reported by the required-file checks */ }
  const seen = new Set();
  for (const n of present) for (const [re, l] of FORBIDDEN_PATTERNS) if (re.test(n)) seen.add(l);
  for (const l of seen) errors.push(`${label}/${l} is present and not allowed (changes install/config resolution)`);

  // 2b. The repo root (the clone) can change how npm installs app/: npm uses a parent workspace root as the project root (its lockfile and
  // .npmrc), and eas archives the git root. So the root may not have a workspaces key at all (no glob matching), nor carry .npmrc*/.yarnrc*/.env*.
  if (root && dir !== root) {
    let rootNames = []; try { rootNames = fs.readdirSync(root); } catch { /* reported by the dir safety check */ }
    const rootSeen = new Set();
    for (const n of rootNames) for (const [re, l] of FORBIDDEN_PATTERNS) if (ROOT_CONFIG_LABELS.includes(l) && re.test(n)) rootSeen.add(l);
    for (const l of rootSeen) errors.push(`root ${l} is present and not allowed (changes how npm installs ${label}/)`);
    let rootLink = false; try { rootLink = fs.lstatSync(join(root, 'package.json')).isSymbolicLink(); } catch { /* absent */ }
    if (rootLink) errors.push('root package.json is a symlink');
    else if (rootNames.includes('package.json')) {
      let rootPkg; try { if (fs.statSync(join(root, 'package.json')).size <= MAX_JSON) rootPkg = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf8')); } catch { /* invalid */ }
      if (!rootPkg || typeof rootPkg !== 'object') errors.push('root package.json is not valid JSON or is too large');
      else if (Object.hasOwn(rootPkg, 'workspaces')) errors.push('root package.json declares workspaces (not allowed: npm may use the root as the project root for app/)');
    }
  }

  const has = (f) => fs.existsSync(join(dir, f));
  const readJson = (f) => { try { if (fs.statSync(join(dir, f)).size > MAX_JSON) return undefined; return JSON.parse(fs.readFileSync(join(dir, f), 'utf8')); } catch { return undefined; } };
  for (const f of ['package.json', 'package-lock.json', 'app.json', 'eas.json']) if (!has(f)) errors.push(`${label}/${f} is missing`);
  if (!versionAtLeast(nodeVersion, MIN_NODE)) errors.push(`this runner's Node is older than 22.13; Expo SDK 58 needs Node >= 22.13`); else lines.push('runner Node satisfies >= 22.13');

  // 3. package-lock.json: v3, registry URLs only, no links, no local-path or unresolved packages.
  const lock = has('package-lock.json') ? readJson('package-lock.json') : undefined;
  if (has('package-lock.json') && !lock) errors.push(`${label}/package-lock.json is not valid JSON or is too large`);
  if (lock) {
    if (lock.lockfileVersion !== 3) errors.push('package-lock.json is not lockfileVersion 3');
    if (lock.dependencies) errors.push('package-lock.json has a legacy dependencies tree');
    let bad = 0, linkN = 0, local = 0, unresolved = 0;
    for (const [k, v] of Object.entries(lock.packages || {})) {
      if (!v || typeof v !== 'object' || k === '') continue;
      if (v.link) linkN++;
      if (!k.includes('node_modules') && !v.link) local++;
      if (typeof v.resolved === 'string' && !/^https:\/\/registry\.npmjs\.org\//.test(v.resolved)) bad++;
      if (!v.resolved && !v.link && !v.inBundle) unresolved++;
    }
    if (bad) errors.push(`package-lock.json has ${bad} resolved URL(s) outside https://registry.npmjs.org/`);
    if (linkN) errors.push(`package-lock.json has ${linkN} link entr(y/ies)`);
    if (local) errors.push(`package-lock.json has ${local} package(s) installed from a local path`);
    if (unresolved) errors.push(`package-lock.json has ${unresolved} package(s) with no resolved URL`);
    if (!bad && !linkN && !local && !unresolved && lock.lockfileVersion === 3) lines.push('package-lock.json: registry URLs only, no links');
  }

  // 4. package.json: no workspaces, no subpath exports/imports or bundled deps, registry specs only (every dependency map, overrides, resolutions).
  const pkg = has('package.json') ? readJson('package.json') : undefined;
  if (has('package.json') && !pkg) errors.push(`${label}/package.json is not valid JSON or is too large`);
  if (pkg) {
    if (pkg.workspaces) errors.push(`${label}/package.json declares workspaces`); else lines.push('no workspaces in package.json');
    for (const k of ['exports', 'imports', 'bundledDependencies', 'bundleDependencies']) if (pkg[k] !== undefined) errors.push(`${label}/package.json has "${k}" (can resolve a plugin to local files)`);
    const specs = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies, pkg.overrides, pkg.resolutions].flatMap(stringsOf);
    const up = specs.filter((v) => isNonRegistrySpec(v));
    if (up.length) errors.push(`${label}/package.json has ${up.length} dependency spec(s) that are not from the npm registry (path, workspace, git or URL)`);
    else lines.push('package.json: registry dependency specs only');
  }

  // 5. app.json: package-name plugins that are declared dependencies, none named after this package, the right bundle id.
  const app = has('app.json') ? readJson('app.json') : undefined;
  if (has('app.json') && !app) errors.push(`${label}/app.json is not valid JSON or is too large`);
  if (app) {
    const exp = app.expo ?? app;
    const plugins = Array.isArray(exp.plugins) ? exp.plugins : [];
    const nameOf = (p) => (Array.isArray(p) ? p[0] : p);
    const local = plugins.filter(isLocalPlugin);
    if (local.length) errors.push(`${label}/app.json lists ${local.length} plugin(s) that are local files, paths or not plain package names`); else lines.push('app.json plugins: package names only');
    if (pkg && typeof pkg.name === 'string' && plugins.some((p) => nameOf(p) === pkg.name || String(nameOf(p)).startsWith(`${pkg.name}/`))) errors.push(`${label}/app.json lists a plugin named after this package itself (resolves to local files)`);
    if (pkg) {
      const declared = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies }));
      const undeclared = plugins.filter((p) => !isLocalPlugin(p)).map((p) => pluginPackage(nameOf(p))).filter((n) => !declared.has(n));
      if (undeclared.length) errors.push(`${label}/app.json lists ${undeclared.length} plugin(s) that are not declared dependencies in package.json`);
    }
    if (exp.ios?.bundleIdentifier === HIGHERSIGNAL_BUNDLE_ID) lines.push(`app.json ios bundle id: ${HIGHERSIGNAL_BUNDLE_ID}`);
    else errors.push(`${label}/app.json ios.bundleIdentifier is not ${HIGHERSIGNAL_BUNDLE_ID}`);
    if (minVersion !== undefined && !versionAbove(String(exp.version ?? ''), minVersion)) errors.push(`${label}/app.json version is not above the released version ${minVersion}`);
    if (!exp.extra?.eas?.projectId) warnings.push('app.json has no extra.eas.projectId; run `eas init` once so EAS knows the project');
  }

  // 6. eas.json: the profile exists and is a store build, with no credentialsSource/extends; build numbers come from EAS and rise on their own.
  const eas = has('eas.json') ? readJson('eas.json') : undefined;
  if (has('eas.json') && !eas) errors.push(`${label}/eas.json is not valid JSON or is too large`);
  if (eas) {
    const prof = eas.build?.[profile];
    if (!prof) errors.push(`${label}/eas.json has no build profile "${profile}"`);
    else {
      lines.push(`eas profile "${profile}": present`);
      if (prof.distribution !== 'store') errors.push(`${label}/eas.json profile "${profile}" is not a store build (distribution must be "store")`);
      if (hasKey(prof, ['credentialsSource', 'extends'])) errors.push(`${label}/eas.json profile "${profile}" uses credentialsSource or extends`);
      if (prof.autoIncrement !== true) errors.push(`${label}/eas.json profile "${profile}" must set autoIncrement: true (build numbers must rise on their own)`);
    }
    if (eas.cli?.appVersionSource !== 'remote') errors.push(`${label}/eas.json cli.appVersionSource is not remote (the build number would not come from EAS)`);
    lines.push(`eas appVersionSource: ${String(eas.cli?.appVersionSource ?? 'unset').slice(0, 20).replace(/[^A-Za-z]/g, '')}`);
    const submitId = eas.submit?.[profile]?.ios?.ascAppId;
    if (submitId !== undefined && appId && String(submitId) !== appId) errors.push(`${label}/eas.json submit ascAppId is not the configured ASC app id`);
  }

  // 7. metro/babel config (loaded by Node tooling): no local requires, process spawning, environment or network access; metro may not reach the parent dir.
  for (const f of ['metro.config.js', 'babel.config.js']) {
    if (!has(f)) { lines.push(`${f}: absent`); continue; }
    let raw; try { raw = fs.statSync(join(dir, f)).size > MAX_CFG ? undefined : fs.readFileSync(join(dir, f), 'utf8'); } catch { raw = undefined; }
    if (raw === undefined) { errors.push(`${label}/${f} is larger than ${MAX_CFG} bytes or unreadable; not scanned`); continue; }
    const flagged = [];
    raw.split(/\r\n|\r|\n/).forEach((l, i) => {
      if (l.length > 2000 || METRO_PARENT_RE.test(l) || /require\(\s*['"](\.|\/|~)/.test(l) || /\bimport\s*\(|child_process|\bexec(Sync)?\b|\bspawn(Sync)?\b|\bfetch\(|\bhttps?:\/\/|process\.env|\beval\(|new Function/.test(l)) flagged.push(i + 1);
    });
    if (flagged.length) errors.push(`${label}/${f} has lines that load local files, reach the parent dir, spawn processes, read the environment or use the network (line ${flagged.slice(0, 5).join(', ')})`);
    else lines.push(`${f}: package-name requires only`);
  }
  return { lines, warnings, errors };
}
