#!/usr/bin/env node
// Read-only App Store Connect API helper. Used by .github/workflows/apple-ops.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-api.mjs <app|builds|prerelease|bundle-ids|iap|build-icon|versions|iap-images|iap-screenshots> --app <ascAppId>
// GET requests only. Nothing here writes to App Store Connect. URLs in responses are hidden.
import { createPrivateKey, sign } from 'node:crypto';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) { console.error(`Missing ${k} (set it as a GitHub Actions secret).`); process.exit(2); }
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

async function get(path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${jwt()}` },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { nonJson: true }; }
  return { status: res.status, body };
}

const [cmd, ...rest] = process.argv.slice(2);
const appId = rest[rest.indexOf('--app') + 1];
if (!cmd || (cmd !== 'bundle-ids' && !appId)) {
  console.error('Usage: asc-api.mjs <app|builds|prerelease|bundle-ids|iap|build-icon|versions|iap-images|iap-screenshots> --app <ascAppId>');
  process.exit(2);
}

if (appId !== undefined && !/^\d{1,20}$/.test(appId)) {
  console.error('--app must be a numeric ASC app id.');
  process.exit(2);
}

const paths = {
  app: `/v1/apps/${appId}?fields[apps]=name,bundleId,sku,primaryLocale`,
  builds: `/v1/builds?filter[app]=${appId}&filter[processingState]=PROCESSING,FAILED,INVALID,VALID` +
    '&sort=-uploadedDate&limit=10' +
    '&fields[builds]=version,uploadedDate,processingState,expired,minOsVersion,usesNonExemptEncryption',
  // /v1/buildUploads has no list endpoint (GET by id only); list pre-release versions instead.
  prerelease: `/v1/preReleaseVersions?filter[app]=${appId}&limit=10&include=builds` +
    '&fields[preReleaseVersions]=version,platform',
  'bundle-ids': '/v1/bundleIds?filter[identifier]=com.timfong888.wouldyourather',
  // In-app purchases (read only): product id, type and review state.
  iap: `/v1/apps/${appId}/inAppPurchasesV2?limit=50` +
    '&fields[inAppPurchases]=name,productId,inAppPurchaseType,state,familySharable',
  // Icon investigation (read only). iconAssetToken is the build's icon asset; only its presence and size print.
  'build-icon': `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=5` +
    '&fields[builds]=version,uploadedDate,processingState,iconAssetToken',
  // App Store versions with their selected build (the App Store icon comes from that build).
  versions: `/v1/apps/${appId}/appStoreVersions?limit=10&include=build` +
    '&fields[appStoreVersions]=versionString,appStoreState,platform,releaseType,createdDate' +
    '&fields[builds]=version,iconAssetToken',
};
// Per-IAP lookups: list the app's IAPs, then one GET per IAP.
const perIap = {
  'iap-images': (id) => `/v2/inAppPurchases/${id}/images?limit=10` +
    '&fields[inAppPurchaseImages]=fileName,fileSize,state',
  'iap-screenshots': (id) => `/v2/inAppPurchases/${id}/appStoreReviewScreenshot` +
    '?fields[inAppPurchaseAppStoreReviewScreenshots]=fileName,fileSize,assetDeliveryState',
};
paths.uploads = paths.prerelease; // 'uploads' kept as the workflow's option name (buildUploads has no list endpoint)
if (!paths[cmd] && !perIap[cmd]) { console.error(`Unknown command ${cmd}`); process.exit(2); }

// Hide URLs (they can carry tokens) and reduce iconAssetToken to presence and size.
function clean(v, key) {
  if (key === 'iconAssetToken') {
    return v ? { present: true, width: v.width, height: v.height } : { present: false };
  }
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? '(url hidden)' : v;
  if (Array.isArray(v)) return v.map((x) => clean(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x, k)]));
  return v;
}

function show({ status, body }, { okStatuses = [] } = {}) {
  console.log(`HTTP ${status}`);
  if (body.errors) {
    for (const e of body.errors) console.log(`ERROR ${e.status} ${e.code}: ${e.title} - ${e.detail}`);
  }
  const rows = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  // JSON:API puts include=... records (e.g. builds of a pre-release version) in `included`.
  const included = Array.isArray(body.included) ? body.included : [];
  for (const r of [...rows, ...included]) {
    console.log(JSON.stringify(clean({ id: r.id, type: r.type, ...r.attributes }), null, 2));
  }
  if (!rows.length && !body.errors) console.log(body.nonJson ? '(non-JSON response, see HTTP status)' : '(no data returned)');
  return status < 400 || okStatuses.includes(status);
}

if (perIap[cmd]) {
  const list = await get(paths.iap);
  console.log(`IAP list: HTTP ${list.status}`);
  const iaps = Array.isArray(list.body.data) ? list.body.data : [];
  let ok = list.status < 400;
  for (const iap of iaps) {
    console.log(`--- ${iap.attributes?.productId ?? iap.id} (${iap.attributes?.state ?? 'state unknown'})`);
    ok = show(await get(perIap[cmd](iap.id)), { okStatuses: [404] }) && ok;
  }
  process.exit(ok ? 0 : 1);
}

process.exit(show(await get(paths[cmd])) ? 0 : 1);
