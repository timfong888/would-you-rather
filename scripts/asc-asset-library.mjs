#!/usr/bin/env node
// App Asset Library upload script. Used by .github/workflows/apple-asset-library.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents), APP_ID,
//      IMAGE_PATH (repo-relative), REFERENCE_NAME (optional), CATEGORY, DRY_RUN.
//
// Flow (reserve → upload → commit):
//   1. GET /v1/apps/{id}/assetLibrary  → resolve library id
//   2. POST /v1/appAssetLibraryImages  → reserve slot, receive uploadOperations
//   3. PUT <uploadUrl>                 → transfer bytes (unauthenticated)
//   4. PATCH /v1/appAssetLibraryImages/{id} uploaded:true  → commit
//
// DRY RUN (default): prints request bodies, makes no API calls.
//
// DELETE (documented at the bottom of this file, never called here):
//   DELETE /v1/appAssetLibraryImages/{imageId}
//   Returns 204 on success. Remove placements first if any exist
//   (GET /v1/appAssetLibraryImages/{id}/placements; DELETE each placement).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReserveBody, buildCommitBody, assertCannotPublish } from './lib/ascAssetLibrary.mjs';

export { buildReserveBody, buildCommitBody, assertCannotPublish };

export function buildJwt({ keyId, issuerId, privateKeyPem }) {
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(privateKeyPem.replace(/\\n/g, '\n'));
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(sig)}`;
}

async function ascGet(path, token) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ascPost(path, body, token) {
  assertCannotPublish(body);
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ascPatch(path, body, token) {
  assertCannotPublish(body);
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function run() {
  const {
    ASC_KEY_ID: keyId,
    ASC_ISSUER_ID: issuerId,
    ASC_PRIVATE_KEY: privateKeyPem,
    APP_ID: appId,
    IMAGE_PATH: imagePath,
    REFERENCE_NAME: referenceName = '',
    CATEGORY: category = 'APP_SCREENSHOTS_AND_PREVIEWS',
    DRY_RUN: dryRunEnv = 'true',
  } = process.env;

  const dryRun = dryRunEnv !== 'false';

  for (const [k, v] of Object.entries({ keyId, issuerId, privateKeyPem, appId, imagePath })) {
    if (!v) { console.error(`Missing env var for ${k}`); process.exit(2); }
  }

  if (!/^\d{1,20}$/.test(appId)) {
    console.error('APP_ID must be a numeric ASC app id.');
    process.exit(2);
  }

  const absPath = resolve(imagePath);
  let fileSize;
  let fileName;
  try {
    fileSize = statSync(absPath).size;
    fileName = absPath.split('/').pop();
  } catch {
    console.error(`Cannot read image at ${absPath}`);
    process.exit(2);
  }

  if (dryRun) {
    console.log('=== DRY RUN (no API calls made) ===');
    console.log('\nStep 1: GET /v1/apps/{id}/assetLibrary');
    console.log(`  URL: https://api.appstoreconnect.apple.com/v1/apps/${appId}/assetLibrary`);

    const reserveBody = buildReserveBody({
      libraryId: '<library-id-from-step-1>',
      fileName,
      fileSize,
      category,
      referenceName,
    });
    console.log('\nStep 2: POST /v1/appAssetLibraryImages');
    console.log('  Body:', JSON.stringify(reserveBody, null, 2));

    console.log('\nStep 3: PUT <uploadUrl from step-2 response>');
    console.log('  Binary: contents of', absPath, `(${fileSize} bytes)`);
    console.log('  Headers: Content-Type: image/png (from uploadOperations.requestHeaders)');

    const commitBody = buildCommitBody({ imageId: '<image-id-from-step-2>' });
    console.log('\nStep 4: PATCH /v1/appAssetLibraryImages/{id}');
    console.log('  Body:', JSON.stringify(commitBody, null, 2));

    console.log('\n--- DELETE (to undo, run separately) ---');
    console.log('  DELETE /v1/appAssetLibraryImages/<image-id>');
    console.log('  Returns 204. Remove placements first if any.');
    return;
  }

  // Live run
  console.log('=== LIVE RUN ===');
  const token = buildJwt({ keyId, issuerId, privateKeyPem });

  console.log('Step 1: Resolving asset library id…');
  const libRes = await ascGet(`/v1/apps/${appId}/assetLibrary`, token);
  const libraryId = libRes.data?.id;
  if (!libraryId) throw new Error(`No asset library found for app ${appId}`);
  console.log('  library id:', libraryId);

  const fileBytes = readFileSync(absPath);
  const reserveBody = buildReserveBody({ libraryId, fileName, fileSize, category, referenceName });

  console.log('Step 2: Reserving image slot…');
  const reserveRes = await ascPost('/v1/appAssetLibraryImages', reserveBody, token);
  const imageId = reserveRes.data?.id;
  const uploadOps = reserveRes.data?.attributes?.uploadOperations ?? [];
  if (!imageId || !uploadOps.length) throw new Error('Reserve call did not return imageId or uploadOperations');
  console.log('  image id:', imageId, '| upload operations:', uploadOps.length);

  console.log('Step 3: Uploading bytes…');
  for (const op of uploadOps) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map(h => [h.name, h.value]));
    const chunk = fileBytes.slice(op.offset, op.offset + op.length);
    const upRes = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!upRes.ok) throw new Error(`Upload PUT → ${upRes.status}`);
  }
  console.log('  Upload complete.');

  console.log('Step 4: Committing…');
  const commitBody = buildCommitBody({ imageId });
  const commitRes = await ascPatch(`/v1/appAssetLibraryImages/${imageId}`, commitBody, token);
  const state = commitRes.data?.attributes?.state;
  console.log('  state after commit:', state);
  console.log('  image id (save to delete):', imageId);

  console.log('\nDone. Asset is in state', state);
  console.log('To delete: DELETE /v1/appAssetLibraryImages/' + imageId + '  (returns 204)');
}

run().catch(e => { console.error(e.message); process.exit(1); });
