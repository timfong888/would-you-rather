#!/usr/bin/env node
// Read-only App Store Connect API helper. Used by .github/workflows/apple-ops.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-api.mjs <app|builds|prerelease|bundle-ids|iap> --app <ascAppId>
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
  console.error('Usage: asc-api.mjs <app|builds|prerelease|bundle-ids|iap> --app <ascAppId>');
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
};
paths.uploads = paths.prerelease; // 'uploads' kept as the workflow's option name (buildUploads has no list endpoint)
if (!paths[cmd]) { console.error(`Unknown command ${cmd}`); process.exit(2); }

const { status, body } = await get(paths[cmd]);
console.log(`HTTP ${status}`);
if (body.errors) {
  for (const e of body.errors) console.log(`ERROR ${e.status} ${e.code}: ${e.title} - ${e.detail}`);
}
const rows = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
// JSON:API puts include=... records (e.g. builds of a pre-release version) in `included`.
const included = Array.isArray(body.included) ? body.included : [];
for (const r of [...rows, ...included]) console.log(JSON.stringify({ id: r.id, type: r.type, ...r.attributes }, null, 2));
if (!rows.length && !body.errors) console.log(body.nonJson ? '(non-JSON response, see HTTP status)' : '(no data returned)');
process.exit(status >= 400 ? 1 : 0);
