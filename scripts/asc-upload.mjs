#!/usr/bin/env node
// Upload an IPA to App Store Connect (TestFlight) via the ASC REST buildUploads API.
// Linux-capable (no Xcode/altool). Used by .github/workflows/apple-upload.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Args: --app <ascAppId> --ipa-url <https://expo.dev/artifacts/eas/...ipa> --version <1.0.0> --build <3>
// Never logs: credentials, the JWT, or pre-signed upload URLs/headers.
import { createPrivateKey, createHash, sign } from 'node:crypto';
import { createWriteStream, createReadStream, statSync, openSync, readSync, closeSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const OFFICIAL_BASE = 'https://api.appstoreconnect.apple.com';
// Test-only override (local mock). Refused unless ASC_ALLOW_ANY_IPA_URL is also set, so the JWT
// can never be sent to a non-Apple host in the workflow.
const BASE = process.env.ASC_BASE_URL || OFFICIAL_BASE;
if (BASE !== OFFICIAL_BASE && !process.env.ASC_ALLOW_ANY_IPA_URL) {
  console.error('ASC_BASE_URL must be the official App Store Connect endpoint.');
  process.exit(2);
}
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) { console.error(`Missing ${k} (set it as a GitHub Actions secret).`); process.exit(2); }
}

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const appId = arg('app'), ipaUrl = arg('ipa-url'), version = arg('version'), build = arg('build');
if (!/^\d{1,20}$/.test(appId || '')) fail('--app must be a numeric ASC app id.');
if (!/^https:\/\/expo\.dev\/artifacts\/eas\/[A-Za-z0-9_-]+\.ipa$/.test(ipaUrl || '') && !process.env.ASC_ALLOW_ANY_IPA_URL) {
  fail('--ipa-url must be an https://expo.dev/artifacts/eas/<id>.ipa URL.');
}
if (!/^\d+(\.\d+){0,2}$/.test(version || '')) fail('--version must look like 1.0.0.');
if (!/^\d+(\.\d+){0,2}$/.test(build || '')) fail('--build must be a numeric build number.');

function fail(msg) { console.error(msg); process.exit(2); }
const b64u = (b) => Buffer.from(b).toString('base64url');

function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }))}.` +
    b64u(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  return `${input}.${b64u(sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }))}`;
}

async function asc(method, path, body, { allowFail = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON: not printed */ }
  if (!res.ok) {
    console.error(`ASC ${method} ${path.split('?')[0]} -> HTTP ${res.status}`);
    for (const e of json?.errors || []) console.error(`  ${e.status} ${e.code}: ${e.title} - ${e.detail}`);
    if (allowFail) return null;
    process.exit(1);
  }
  return json;
}

// 1. Download the IPA from the EAS artifact URL.
const ipaPath = '/tmp/upload.ipa';
const dl = await fetch(ipaUrl, { redirect: 'follow' });
if (!dl.ok) fail(`IPA download failed: HTTP ${dl.status}`);
await pipeline(Readable.fromWeb(dl.body), createWriteStream(ipaPath));
const size = statSync(ipaPath).size;
const sha = createHash('sha256');
await pipeline(createReadStream(ipaPath), sha);
const hash = sha.digest('hex');
const md5 = createHash('md5');
await pipeline(createReadStream(ipaPath), md5);
const md5hex = md5.digest('hex');
console.log(`IPA downloaded: ${size} bytes, sha256 ${hash.slice(0, 12)}...`);

// 2. Create the build upload.
const upload = await asc('POST', '/v1/buildUploads', {
  data: {
    type: 'buildUploads',
    attributes: { cfBundleShortVersionString: version, cfBundleVersion: build, platform: 'IOS' },
    relationships: { app: { data: { type: 'apps', id: appId } } },
  },
});
const uploadId = upload.data.id;
console.log(`buildUpload created: ${uploadId}`);

// 3. Reserve the file and get pre-signed part operations (URLs/headers are never printed).
const fileRes = await asc('POST', '/v1/buildUploadFiles', {
  data: {
    type: 'buildUploadFiles',
    attributes: { fileName: 'app.ipa', fileSize: size, uti: 'com.apple.ipa', assetType: 'ASSET' },
    relationships: { buildUpload: { data: { type: 'buildUploads', id: uploadId } } },
  },
});
const fileId = fileRes.data.id;
const ops = fileRes.data.attributes.uploadOperations || [];
console.log(`file reserved: ${fileId}, ${ops.length} part(s)`);

// 4. PUT each part.
const fd = openSync(ipaPath, 'r');
try {
  let n = 0;
  for (const op of ops) {
    const buf = Buffer.alloc(op.length);
    const got = readSync(fd, buf, 0, op.length, op.offset);
    if (got !== op.length) fail(`part ${n + 1}/${ops.length}: short read (${got}/${op.length} bytes); not uploading.`);
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method || 'PUT', headers, body: buf });
    if (!res.ok) fail(`part ${n + 1}/${ops.length} upload failed: HTTP ${res.status}`);
    n += 1;
  }
  console.log(`uploaded ${n} part(s)`);
} finally { closeSync(fd); }

// 5. Commit. Apple rejected a SHA_256 `sourceFileChecksums` value (HTTP 409 on first live run), and
// the field is optional, so try MD5, then no checksum. Integrity is still covered by TLS.
const commitVariants = [
  ['MD5 checksum', { file: { hash: md5hex, algorithm: 'MD5' } }],
  ['no checksum', undefined],
];
let committed = false;
for (const [label, sums] of commitVariants) {
  const res = await asc('PATCH', `/v1/buildUploadFiles/${fileId}`, {
    data: {
      type: 'buildUploadFiles', id: fileId,
      attributes: { uploaded: true, ...(sums ? { sourceFileChecksums: sums } : {}) },
    },
  }, { allowFail: true });
  if (res) { console.log(`commit accepted (${label})`); committed = true; break; }
  console.log(`commit rejected with ${label}`);
}
if (!committed) fail('Could not commit the upload with any checksum variant.');
console.log('upload committed; polling processing state');

// 6. Poll the upload state (attributes only).
let last = '';
for (let i = 0; i < 30; i++) {
  const s = await asc('GET', `/v1/buildUploads/${uploadId}`);
  const st = s.data.attributes?.state || {};
  last = st.state || 'UNKNOWN';
  console.log(`state: ${last}`);
  for (const e of st.errors || []) console.log(`  error ${e.code || ''}: ${e.description || e.message || ''}`);
  for (const w of st.warnings || []) console.log(`  warning ${w.code || ''}: ${w.description || w.message || ''}`);
  if (['COMPLETE', 'FAILED'].includes(last)) break;
  await new Promise((r) => setTimeout(r, 15000));
}
if (!['COMPLETE', 'FAILED'].includes(last)) {
  console.error(`Timed out waiting for COMPLETE; last state: ${last}. Check TestFlight / run Apple ops "builds".`);
  process.exit(1);
}
process.exit(last === 'FAILED' ? 1 : 0);
