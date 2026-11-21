#!/usr/bin/env node
// Push listing TEXT (name, subtitle, description, keywords, URLs, copyright) to App Store Connect.
// Used by .github/workflows/apple-metadata.yml. DRY RUN by default: it validates, reads App Store
// Connect, and prints what would change. Writes only with --apply AND "approved": true in the file.
// Never touches builds, screenshots, pricing, age rating or review submission.
// Env (read and dry-run need them to diff; validation alone does not): ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY.
import { readFileSync } from 'node:fs';
import { createPrivateKey, sign } from 'node:crypto';
import { validateListing, syncListing } from './lib/ascMetadata.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const appId = args[args.indexOf('--app') + 1];
const file = args.includes('--file') ? args[args.indexOf('--file') + 1] : 'store/ios/listing-final.json';
if (!/^\d{1,20}$/.test(appId ?? '')) { console.error('Usage: asc-metadata.mjs --app <numeric ASC app id> [--file path] [--apply]'); process.exit(2); }

const listing = JSON.parse(readFileSync(file, 'utf8'));
const errors = validateListing(listing);
if (errors.length) { console.error('Listing is invalid:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Listing ${file} is valid (${listing.locale}).`);
if (apply && listing.approved !== true) { console.error('Refusing to apply: "approved" is not true in the listing file. Tim approves by setting it in a reviewed commit.'); process.exit(1); }

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_PRIVATE_KEY) {
  if (apply) { console.error('Missing ASC_* secrets.'); process.exit(2); }
  console.log('No ASC_* secrets: validation only, nothing compared with App Store Connect.');
  process.exit(0);
}

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  return `${input}.${b64u(sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = {}; }
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} -> HTTP ${res.status}: ${(json.errors ?? []).map((e) => `${e.code} ${e.detail}`).join('; ')}`);
  return json;
}

try {
  const log = await syncListing({ api, appId, listing, apply });
  console.log(apply ? 'APPLIED:' : 'DRY RUN, would change:');
  console.log(log.length ? JSON.stringify(log, null, 2) : '(nothing: App Store Connect already matches)');
  if (!apply) console.log('Re-run with apply=true (and approved:true in the file) to write.');
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
