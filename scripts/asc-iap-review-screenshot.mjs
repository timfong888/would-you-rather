#!/usr/bin/env node
// Uploads the App Review screenshot for each in-app purchase from
// store/ios/iap-review/<productId>.png to App Store Connect. WRITES to App
// Store Connect. Run only by .github/workflows/apple-iap-review-screenshot.yml.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-iap-review-screenshot.mjs --app <ascAppId> [--apply] [--replace]
//   Default: dry run. Only GET requests; prints the plan and each IAP's state.
//   --apply: for each IAP without a review screenshot:
//     1. POST  /v1/inAppPurchaseAppStoreReviewScreenshots   (reserve: file name + size)
//     2. PUT   the bytes to Apple's upload operations
//     3. PATCH /v1/inAppPurchaseAppStoreReviewScreenshots/id (uploaded=true + MD5 checksum)
//   --replace (with --apply): delete an existing screenshot first, then upload.
// Never submits anything for review.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { api, getAll, PRODUCTS_FILE } from './asc-iap-create.mjs';

export const SHOT_DIR = new URL('../store/ios/iap-review/', import.meta.url);
export const WIDTH = 1290;
export const HEIGHT = 2796;

/** PNG width/height from the IHDR chunk, or null if the buffer is not a PNG. */
export function pngSize(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Problems with a screenshot file (missing, not a PNG, wrong size). */
export function shotProblems(productId, buf) {
  if (!buf) return [`${productId}: no screenshot file`];
  const size = pngSize(buf);
  if (!size) return [`${productId}: not a PNG`];
  if (size.width !== WIDTH || size.height !== HEIGHT) return [`${productId}: ${size.width}x${size.height}, want ${WIDTH}x${HEIGHT}`];
  return [];
}

/**
 * What to do per product. iaps: Map productId -> { id, state }; existing: Map
 * iapId -> screenshot id (or undefined).
 */
export function plan(products, iaps, existing, { replace = false } = {}) {
  return products.map((p) => {
    const iap = iaps.get(p.productId);
    if (!iap) return { productId: p.productId, action: 'missing-iap' };
    const shotId = existing.get(iap.id);
    if (shotId && !replace) return { productId: p.productId, iapId: iap.id, state: iap.state, action: 'skip' };
    return { productId: p.productId, iapId: iap.id, state: iap.state, action: shotId ? 'replace' : 'upload', shotId };
  });
}

async function existingShot(iapId) {
  try {
    const r = await api('GET', `/v2/inAppPurchases/${iapId}/appStoreReviewScreenshot`);
    return r.data?.id;
  } catch (e) {
    if (/HTTP 404/.test(e.message)) return undefined;
    throw e;
  }
}

async function upload(iapId, productId, buf) {
  const fileName = `${productId}.png`;
  const reserved = await api('POST', '/v1/inAppPurchaseAppStoreReviewScreenshots', {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      attributes: { fileName, fileSize: buf.length },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id: iapId } } },
    },
  });
  const id = reserved.data.id;
  for (const op of reserved.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`${productId}: upload part at ${op.offset} -> HTTP ${res.status}`);
  }
  await api('PATCH', `/v1/inAppPurchaseAppStoreReviewScreenshots/${id}`, {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      id,
      attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(buf).digest('hex') },
    },
  });
  // Apple processes the image asynchronously; wait briefly for a verdict.
  for (let i = 0; i < 10; i++) {
    const r = await api('GET', `/v1/inAppPurchaseAppStoreReviewScreenshots/${id}`);
    const st = r.data?.attributes?.assetDeliveryState;
    if (st?.state === 'COMPLETE') return 'COMPLETE';
    if (st?.state === 'FAILED') throw new Error(`${productId}: Apple rejected the image: ${JSON.stringify(st.errors ?? [])}`);
    await new Promise((res) => setTimeout(res, 3000));
  }
  return 'PROCESSING';
}

async function main() {
  const args = process.argv.slice(2);
  const appId = args[args.indexOf('--app') + 1];
  const apply = args.includes('--apply');
  const replace = args.includes('--replace');
  if (!/^\d{1,20}$/.test(appId ?? '')) { console.error('--app <numeric ASC app id> is required.'); process.exit(2); }
  for (const k of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY']) {
    if (!process.env[k]) { console.error(`Missing ${k} (GitHub Actions secret).`); process.exit(2); }
  }

  const spec = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const files = new Map(spec.products.map((p) => {
    const f = new URL(`${p.productId}.png`, SHOT_DIR);
    return [p.productId, existsSync(f) ? readFileSync(f) : null];
  }));
  // Products marked reviewShot "device" get their shot from a device after F5b (#252): listed, not uploaded.
  // Any other product must have a valid file, so a lost shot fails the run instead of passing quietly.
  const later = spec.products.filter((p) => p.reviewShot === 'device');
  for (const p of later) console.log(`NO SCREENSHOT YET (device shot after F5b, skipped)  ${p.productId}`);
  const shot = spec.products.filter((p) => p.reviewShot !== 'device');
  const problems = shot.flatMap((p) => shotProblems(p.productId, files.get(p.productId)));
  if (problems.length) { console.error(`Screenshots invalid:\n- ${problems.join('\n- ')}`); process.exit(2); }

  const rows = await getAll(`/v1/apps/${appId}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,state`);
  const iaps = new Map(rows.map((r) => [r.attributes.productId, { id: r.id, state: r.attributes.state }]));
  const existing = new Map();
  for (const iap of iaps.values()) existing.set(iap.id, await existingShot(iap.id));

  const steps = plan(shot, iaps, existing, { replace });
  let failed = 0;
  for (const s of steps) {
    if (s.action === 'missing-iap') { failed++; console.log(`MISSING IAP  ${s.productId} (run apple-iap-create first)`); continue; }
    if (s.action === 'skip') { console.log(`SKIP (has screenshot)  ${s.productId}  state=${s.state}`); continue; }
    if (!apply) { console.log(`WOULD ${s.action.toUpperCase()}  ${s.productId}  state=${s.state}`); continue; }
    try {
      if (s.action === 'replace') await api('DELETE', `/v1/inAppPurchaseAppStoreReviewScreenshots/${s.shotId}`);
      const result = await upload(s.iapId, s.productId, files.get(s.productId));
      console.log(`UPLOADED  ${s.productId}  image=${result}`);
    } catch (e) {
      failed++;
      console.log(`FAILED  ${s.productId}: ${e.message}`);
    }
  }

  // Each IAP's state afterwards (READY_TO_SUBMIT once metadata, price and screenshot are complete).
  if (apply) {
    for (const p of spec.products) {
      const iap = iaps.get(p.productId);
      if (!iap) continue;
      const r = await api('GET', `/v2/inAppPurchases/${iap.id}?fields[inAppPurchases]=state`);
      console.log(`STATE  ${p.productId}  ${r.data.attributes.state}`);
    }
  } else {
    console.log('Dry run: nothing written. Re-run with apply=true to upload.');
  }
  if (failed) process.exit(1);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((e) => { console.error(e.message); process.exit(1); });
