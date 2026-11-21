#!/usr/bin/env node
// Attach an uploaded build to a TestFlight beta group. Used by .github/workflows/apple-testflight-group.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-testflight-group.mjs --app <ascAppId> --build <n> [--version 1.0.0] [--group "Name"] [--apply]
// Without --apply this only lists groups and finds the build (dry run). With --apply it attaches the build.
// Never submits for App Review and never touches testers or groups themselves.
import { createPrivateKey, sign } from 'node:crypto';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) { console.error(`Missing ${k} (set it as a GitHub Actions secret).`); process.exit(2); }
}

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const appId = opt('app');
const build = opt('build');
const version = opt('version') ?? '1.0.0';
const groupName = opt('group');
const apply = args.includes('--apply');
if (!/^\d{1,20}$/.test(appId ?? '') || !/^\d{1,9}$/.test(build ?? '')) {
  console.error('Usage: --app <numeric ASC app id> --build <numeric build number> [--version x.y.z] [--group name] [--apply]');
  process.exit(2);
}

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

async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { nonJson: true }; }
  return { status: res.status, json };
}
// Follow links.next so a long list (a group that has all builds) is never cut at one page.
async function getAll(path) {
  const out = [];
  let next = path;
  for (let page = 0; next && page < 50; page++) {
    const r = await api('GET', next);
    if (r.status !== 200) fail(`GET ${path}`, r);
    out.push(...(r.json.data ?? []));
    const link = r.json.links?.next;
    next = link ? link.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  // Never return a truncated list as if it were complete: a partial group list would make the
  // membership checks wrong (and could report a failure after a successful attach).
  if (next) {
    console.error(`GET ${path}: still more pages after 50; refusing to use a partial list.`);
    process.exit(1);
  }
  return out;
}
function fail(what, r) {
  console.error(`${what}: HTTP ${r.status}`);
  for (const e of r.json.errors ?? []) console.error(`  ${e.code}: ${e.title} - ${e.detail}`);
  process.exit(1);
}

// 1. beta groups
const groups = await getAll(`/v1/apps/${appId}/betaGroups?limit=200&fields[betaGroups]=name,isInternalGroup,hasAccessToAllBuilds,publicLinkEnabled`);
console.log('Beta groups:');
for (const g of groups) {
  const a = g.attributes;
  console.log(`  - "${a.name}" id=${g.id} internal=${a.isInternalGroup} hasAccessToAllBuilds=${a.hasAccessToAllBuilds} publicLink=${a.publicLinkEnabled}`);
}

// 2. the build
const buildRes = await api('GET', `/v1/builds?filter[app]=${appId}&filter[version]=${build}&filter[preReleaseVersion.version]=${encodeURIComponent(version)}&fields[builds]=version,processingState,expired,uploadedDate`);
if (buildRes.status !== 200) fail('Find build', buildRes);
const found = buildRes.json.data ?? [];
if (found.length !== 1) { console.error(`Expected exactly one build ${version} (${build}), found ${found.length}.`); process.exit(1); }
const b = found[0];
console.log(`Build ${version} (${build}): id=${b.id} processingState=${b.attributes.processingState} expired=${b.attributes.expired}`);
if (b.attributes.processingState !== 'VALID' || b.attributes.expired) { console.error('Build is not VALID or is expired; not attaching.'); process.exit(1); }

// 3. pick the group
let target;
if (groupName) {
  target = groups.find((g) => g.attributes.name === groupName);
  if (!target) { console.error(`No beta group named "${groupName}".`); process.exit(1); }
} else {
  const internal = groups.filter((g) => g.attributes.isInternalGroup);
  if (internal.length !== 1) { console.error(`Pass --group: found ${internal.length} internal groups, need exactly 1.`); process.exit(1); }
  target = internal[0];
}
const ta = target.attributes;
console.log(`Target group: "${ta.name}" (${target.id}) hasAccessToAllBuilds=${ta.hasAccessToAllBuilds}`);

// Membership is by build id: build numbers repeat across marketing versions.
const listAttached = async () =>
  (await getAll(`/v1/betaGroups/${target.id}/builds?limit=200&fields[builds]=version,processingState`))
    .map((x) => ({ id: x.id, version: x.attributes.version }));
const show = (list) => list.map((x) => x.version).join(', ') || '(none)';
const before = await listAttached();
console.log(`Builds in group before (${before.length}): ${show(before)}`);

if (!apply) { console.log('Dry run: nothing changed. Re-run with --apply to attach.'); process.exit(0); }

if (before.some((x) => x.id === b.id)) {
  console.log(`Build ${build} is already in "${ta.name}". Nothing to do.`);
} else {
  const r = await api('POST', `/v1/betaGroups/${target.id}/relationships/builds`, { data: [{ type: 'builds', id: b.id }] });
  if (r.status !== 204 && r.status !== 200) fail('Attach build to group', r);
  console.log('Attach request accepted.');
}
const after = await listAttached();
console.log(`Builds in group after (${after.length}): ${show(after)}`);
if (!after.some((x) => x.id === b.id)) { console.error(`Build ${build} is NOT in the group after the request.`); process.exit(1); }
console.log(`OK: build ${build} is attached to "${ta.name}".`);
