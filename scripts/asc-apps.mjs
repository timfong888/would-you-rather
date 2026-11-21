#!/usr/bin/env node
// READ-ONLY: list App Store Connect apps whose name or bundle ID contains a string, with their store state.
// Also lists portal bundle IDs (App IDs) that match, so an App ID with no app record shows up too.
// Used by .github/workflows/apple-apps.yml. Only issues GET requests; creates and edits nothing.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-apps.mjs --match neville
import { createPrivateKey, sign } from 'node:crypto';
import { matchesApp, stateLabel, isLive } from './lib/ascApps.mjs';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) { console.error(`Missing ${k} (set it as a GitHub Actions secret).`); process.exit(2); }
}
const args = process.argv.slice(2);
const mi = args.indexOf('--match');
const needle = mi >= 0 ? args[mi + 1] ?? '' : '';
if (needle.length > 100 || /[^\w .\-]/.test(needle)) { console.error('--match may only contain letters, digits, space, dot, dash, underscore.'); process.exit(2); }

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(sig)}`;
}

// GET only. There is deliberately no other method in this file.
async function get(path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { method: 'GET', headers: { Authorization: `Bearer ${jwt()}` } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = {}; }
  if (res.status !== 200) {
    console.error(`GET ${path.split('?')[0]}: HTTP ${res.status}`);
    for (const e of json.errors ?? []) console.error(`  ${e.code}: ${e.title} - ${e.detail}`);
    process.exit(1);
  }
  return json;
}
async function getAll(path) {
  const out = [];
  let next = path;
  for (let page = 0; next && page < 50; page++) {
    const j = await get(next);
    out.push(...(j.data ?? []));
    const link = j.links?.next;
    next = link ? link.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  if (next) { console.error(`GET ${path.split('?')[0]}: still more pages after 50; refusing to use a partial list.`); process.exit(1); }
  return out;
}

const apps = (await getAll('/v1/apps?limit=200&fields[apps]=name,bundleId,sku,primaryLocale,contentRightsDeclaration')).filter((a) => matchesApp(a.attributes, needle));
console.log(`Apps matching "${needle}": ${apps.length}`);
let liveCount = 0;
for (const a of apps) {
  const at = a.attributes;
  const versions = await getAll(`/v1/apps/${a.id}/appStoreVersions?limit=200&fields[appStoreVersions]=versionString,platform,appStoreState,appVersionState,createdDate,releaseType`);
  versions.sort((x, y) => String(y.attributes.createdDate).localeCompare(String(x.attributes.createdDate)));
  const live = isLive(versions);
  if (live) liveCount++;
  console.log(`\nAPP "${at.name}"  bundleId=${at.bundleId}  sku=${at.sku}  appId=${a.id}  locale=${at.primaryLocale}`);
  console.log(`  LIVE on the App Store: ${live ? 'YES' : 'no'}`);
  if (!versions.length) console.log('  (no App Store versions)');
  for (const v of versions.slice(0, 6)) {
    const va = v.attributes;
    console.log(`  - ${va.platform} ${va.versionString}  state=${va.appStoreState ?? va.appVersionState} (${stateLabel(va.appStoreState ?? va.appVersionState)})  created=${va.createdDate}`);
  }
  const builds = await get(`/v1/builds?filter[app]=${a.id}&sort=-uploadedDate&limit=1&fields[builds]=version,uploadedDate,processingState`);
  const b = builds.data?.[0]?.attributes;
  console.log(`  latest build: ${b ? `${b.version} uploaded ${b.uploadedDate} (${b.processingState})` : 'none'}`);
}

const bundles = (await getAll('/v1/bundleIds?limit=200&fields[bundleIds]=name,identifier,platform')).filter((b) => matchesApp({ name: b.attributes.name, bundleId: b.attributes.identifier }, needle));
console.log(`\nPortal bundle IDs (App IDs) matching "${needle}": ${bundles.length}`);
for (const b of bundles) {
  const at = b.attributes;
  const linked = apps.filter((a) => a.attributes.bundleId === at.identifier);
  console.log(`  - name="${at.name}"  identifier=${at.identifier}  platform=${at.platform}  app record: ${linked.length ? linked.map((a) => `"${a.attributes.name}" (${a.id})`).join(', ') : 'NONE'}`);
}
console.log(`\nSummary: ${liveCount} matching app(s) LIVE.`);
