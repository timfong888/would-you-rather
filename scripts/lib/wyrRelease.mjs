// Pure helpers for scripts/wyr-testflight.mjs (build the Would You Rather iOS app on EAS, send it to TestFlight).
// Shared pieces (poll, outcome, tail, redaction) come from nevilleRelease.mjs and ascAppsList.mjs; only what differs is here.
import { join } from 'node:path';
import { isParentDep } from './nevilleRelease.mjs';

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

// ---------------------------------------------------------------------------------------------------------------------
// Secretless self-containment check of the cloned wyr_sha, run BEFORE npm ci and before the secret step.
// The secret step runs eas-cli with EXPO_TOKEN and the ASC key in its environment, in the clone: eas-cli evaluates the clone's
// Expo config (app.config.*, app.json plugins) and the plugins load from the clone's node_modules. So anything in the clone that
// can make npm or eas-cli run or fetch other code must be refused here, for ANY ancestor of main, not only today's tree.
// Prints fixed text and line numbers only (never file content). Returns { lines, warnings, errors }. `fs` is injected for tests.
export const WYR_MAX_FILES = 20000;
export const WYR_MAX_JSON_BYTES = 20 * 1024 * 1024;
export const WYR_FORBIDDEN_FILES = ['.npmrc', 'app.config.js', 'app.config.ts', 'app.config.mjs', 'app.config.cjs', 'app.config.json'];
const SKIP_DIRS = new Set(['.git', 'node_modules']);

// A plugin must be a package NAME: a string with no path syntax. Anything else (a function, a path, ../x, file:, an absolute path) runs local code.
export function isLocalPlugin(p) {
  const n = Array.isArray(p) ? p[0] : p;
  return typeof n !== 'string' || /^(\.|\/|\\|~|[A-Za-z]:|(file|link|portal):)/i.test(n.trim()) || n.includes('..');
}

// A dependency spec that does not come from the npm registry: local path, workspace, git or any URL.
export function isNonRegistrySpec(spec) {
  const v = String(spec).trim();
  return isParentDep(v) || /^(file|link|portal|workspace|git|git\+[a-z]+|github|gitlab|bitbucket|http|https|ssh):/i.test(v) || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(#.*)?$/.test(v) || v.includes('://');
}

/** @param {string} dir @param {{ fs: any, profile?: string }} opts */
export function checkWyrSelfContained(dir, { fs, profile = WYR_PROFILE }) {
  const lines = [], warnings = [], errors = [];
  let st;
  try { st = fs.lstatSync(dir); } catch { errors.push('the checkout directory does not exist'); return { lines, warnings, errors }; }
  if (st.isSymbolicLink() || !st.isDirectory()) { errors.push('the checkout path is not a real directory'); return { lines, warnings, errors }; }

  // 1. No symlink anywhere in the tree (a link could point a config file or a plugin outside the clone), bounded walk.
  const links = []; let count = 0; let truncated = false;
  const walk = (d) => {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (truncated) return;
      const full = join(d, e.name);
      if (++count > WYR_MAX_FILES) { truncated = true; return; }
      let l; try { l = fs.lstatSync(full); } catch { continue; }
      if (l.isSymbolicLink()) { links.push(full.slice(dir.length + 1)); continue; }
      if (l.isDirectory() && !SKIP_DIRS.has(e.name)) walk(full);
    }
  };
  walk(dir);
  if (truncated) errors.push(`the checkout has more than ${WYR_MAX_FILES} entries; not scanned`);
  if (links.length) errors.push(`the checkout contains ${links.length} symlink(s) (first: ${links.slice(0, 3).map((x) => x.replace(/[^A-Za-z0-9_./@-]/g, '?').slice(0, 80)).join(', ')})`);
  else lines.push('no symlinks in the checkout');

  // 2. Files that change what npm or eas-cli resolve or run.
  let top = []; try { top = fs.readdirSync(dir); } catch { /* reported below */ }
  const bad = top.filter((n) => WYR_FORBIDDEN_FILES.includes(n) || n.startsWith('.yarnrc'));
  for (const n of bad) errors.push(`${n.startsWith('.yarnrc') ? '.yarnrc*' : n} is present and not allowed (changes npm or Expo config resolution)`);
  if (!bad.length) lines.push('no .npmrc, .yarnrc* or app.config.* files');
  for (const n of top.filter((x) => /^\.npmrc/.test(x) && x !== '.npmrc')) errors.push(`${n.replace(/[^A-Za-z0-9_.-]/g, '?')} is present and not allowed`);

  const has = (f) => fs.existsSync(join(dir, f));
  const readJson = (f) => {
    try {
      if (fs.statSync(join(dir, f)).size > WYR_MAX_JSON_BYTES) { errors.push(`${f} is larger than ${WYR_MAX_JSON_BYTES} bytes; not scanned`); return undefined; }
      return JSON.parse(fs.readFileSync(join(dir, f), 'utf8'));
    } catch { return undefined; }
  };
  for (const f of ['package.json', 'package-lock.json', 'app.json', 'eas.json']) if (!has(f)) errors.push(`${f} is missing`);

  // 3. package.json: no workspaces, no non-registry dependency of any kind (also overrides and resolutions).
  const pkg = has('package.json') ? readJson('package.json') : undefined;
  if (has('package.json') && !pkg) errors.push('package.json is not valid JSON');
  if (pkg) {
    if (pkg.workspaces) errors.push('package.json declares workspaces'); else lines.push('no workspaces in package.json');
    const flat = (o, acc = []) => { for (const v of Object.values(o || {})) { if (typeof v === 'string') acc.push(v); else if (v && typeof v === 'object') flat(v, acc); } return acc; };
    const specs = [pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies, pkg.peerDependencies, pkg.overrides, pkg.resolutions].flatMap((o) => flat(o));
    const nonReg = specs.filter(isNonRegistrySpec);
    if (nonReg.length) errors.push(`package.json has ${nonReg.length} dependency spec(s) that are not from the npm registry (path, workspace, git or URL)`);
    else lines.push('all package.json dependencies come from the npm registry');
    if (pkg.bundledDependencies || pkg.bundleDependencies) errors.push('package.json lists bundled dependencies');
  }

  // 4. package-lock.json: every resolved URL is the npm registry over https; no link or file entries.
  const lock = has('package-lock.json') ? readJson('package-lock.json') : undefined;
  if (has('package-lock.json') && !lock) errors.push('package-lock.json is not valid JSON');
  if (lock) {
    let badRes = 0, links2 = 0, local = 0;
    for (const [k, v] of Object.entries(lock.packages || {})) {
      if (!v || typeof v !== 'object') continue;
      if (v.link) links2++;
      if (k !== '' && !k.includes('node_modules') && !v.link) local++; // a package that lives at a path outside node_modules
      if (typeof v.resolved === 'string' && !/^https:\/\/registry\.npmjs\.org\//.test(v.resolved)) badRes++;
    }
    if (badRes) errors.push(`package-lock.json has ${badRes} resolved URL(s) outside https://registry.npmjs.org/`);
    if (links2) errors.push(`package-lock.json has ${links2} link entr(y/ies)`);
    if (local) errors.push(`package-lock.json has ${local} package(s) installed from a local path`);
    if (!badRes && !links2 && !local) lines.push('package-lock.json: registry URLs only, no links');
  }

  // 5. app.json: package-name plugins only, the right bundle id.
  const app = has('app.json') ? readJson('app.json') : undefined;
  if (has('app.json') && !app) errors.push('app.json is not valid JSON');
  if (app) {
    const exp = app.expo ?? app;
    const plugins = Array.isArray(exp.plugins) ? exp.plugins : [];
    const local = plugins.filter(isLocalPlugin);
    if (local.length) errors.push(`app.json lists ${local.length} plugin(s) that are local files, paths or not plain names; only package-name plugins are allowed`);
    else lines.push('app.json plugins: package names only');
    if (exp.ios?.bundleIdentifier !== WYR_BUNDLE_ID) errors.push(`app.json ios.bundleIdentifier is not ${WYR_BUNDLE_ID}`); else lines.push(`app.json ios bundle id: ${WYR_BUNDLE_ID}`);
  }

  // 6. eas.json: the fixed profile exists and is a store build; the submit app id is this app's.
  const eas = has('eas.json') ? readJson('eas.json') : undefined;
  if (has('eas.json') && !eas) errors.push('eas.json is not valid JSON');
  if (eas) {
    const prof = eas.build?.[profile];
    if (!prof) errors.push(`eas.json has no build profile "${profile}"`);
    else if (prof.distribution !== 'store') errors.push(`eas.json profile "${profile}" is not a store build`);
    else lines.push(`eas profile "${profile}": present, store distribution`);
    if (eas.submit?.[profile]?.ios?.ascAppId !== WYR_APP_ID) errors.push('eas.json submit ascAppId is not the Would You Rather app');
    lines.push(`eas appVersionSource: ${String(eas.cli?.appVersionSource ?? 'unset').slice(0, 20).replace(/[^A-Za-z]/g, '')}`);
  }

  // 7. Config files that Node code in eas-cli's reach may load (metro/babel): only package-name requires, no process or network access.
  for (const f of ['metro.config.js', 'babel.config.js']) {
    if (!has(f)) { lines.push(`${f}: absent`); continue; }
    let raw; try { raw = fs.statSync(join(dir, f)).size > 256 * 1024 ? undefined : fs.readFileSync(join(dir, f), 'utf8'); } catch { raw = undefined; }
    if (raw === undefined) { errors.push(`${f} is larger than 256 KiB or unreadable; not scanned`); continue; }
    const src = raw.split(/\r\n|\r|\n/);
    const flagged = [];
    src.forEach((l, i) => {
      if (l.length > 2000) flagged.push(i + 1);
      else if (/require\(\s*['"](\.|\/|~)/.test(l) || /\bimport\s*\(|child_process|\bexec(Sync)?\b|\bspawn(Sync)?\b|\bfetch\(|\bhttps?:\/\/|process\.env|\beval\(|new Function/.test(l)) flagged.push(i + 1);
    });
    if (flagged.length) errors.push(`${f} has lines that load local files, spawn processes, read the environment or use the network (line ${flagged.slice(0, 5).join(', ')})`);
    else lines.push(`${f}: package-name requires only`);
  }
  return { lines, warnings, errors };
}
