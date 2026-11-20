#!/usr/bin/env node
// Creates the in-app purchases in store/ios/iap-products.json in App Store
// Connect. WRITES to App Store Connect. Run only by
// .github/workflows/apple-iap-create.yml, and only with Tim's explicit go.
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-iap-create.mjs --app <ascAppId> [--apply]
//   Without --apply (default): dry run. Only GET requests; prints the plan.
//   With --apply: per product not already in App Store Connect:
//     1. POST /v2/inAppPurchases            (Non-Consumable, reference name, review note)
//     2. POST /v1/inAppPurchaseLocalizations (en-US display name + description)
//     3. POST /v1/inAppPurchasePriceSchedules (USA base price; Apple equalizes other territories)
//     4. POST /v1/inAppPurchaseAvailabilities (every territory, plus new ones)
// Idempotent: a product id that already exists is skipped, never changed.
// Never submits anything for review; the review screenshot stays manual.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const PRODUCTS_FILE = new URL('../store/ios/iap-products.json', import.meta.url);

/** Validates the product file against App Store Connect's field limits. Returns problems. */
export function validateProducts(spec) {
  const problems = [];
  const seen = new Set();
  if (spec.type !== 'NON_CONSUMABLE') problems.push(`type must be NON_CONSUMABLE, got ${spec.type}`);
  for (const p of spec.products ?? []) {
    if (!/^[A-Za-z0-9_.]{1,100}$/.test(p.productId ?? '')) problems.push(`bad productId ${p.productId}`);
    if (seen.has(p.productId)) problems.push(`duplicate productId ${p.productId}`);
    seen.add(p.productId);
    if (!p.referenceName || p.referenceName.length > 64) problems.push(`${p.productId}: referenceName 1-64 chars`);
    if (!p.displayName || p.displayName.length > 30) problems.push(`${p.productId}: displayName 1-30 chars`);
    if (!p.description || p.description.length > 45) problems.push(`${p.productId}: description 1-45 chars`);
    if (!/^\d+\.\d{2}$/.test(p.priceUsd ?? '')) problems.push(`${p.productId}: priceUsd like "1.99"`);
  }
  return problems;
}

/** Picks the price point whose customerPrice equals the wanted USD price. */
export function findPricePoint(points, priceUsd) {
  return points.find((pp) => Number(pp.attributes?.customerPrice) === Number(priceUsd)) ?? null;
}

const b64u = (b) => Buffer.from(b).toString('base64url');

function jwt() {
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY } = process.env;
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
  let json; try { json = JSON.parse(text); } catch { json = {}; }
  if (res.status >= 400) {
    const errs = (json.errors ?? []).map((e) => `${e.status} ${e.code}: ${e.title} - ${e.detail}`).join('; ');
    throw new Error(`${method} ${path.split('?')[0]} -> HTTP ${res.status} ${errs}`);
  }
  return json;
}

async function getAll(path) {
  const out = [];
  let next = path;
  while (next) {
    const page = await api('GET', next);
    out.push(...(page.data ?? []));
    next = page.links?.next ? page.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return out;
}

async function createOne(appId, spec, p, territories) {
  const iap = await api('POST', '/v2/inAppPurchases', {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: p.referenceName,
        productId: p.productId,
        inAppPurchaseType: spec.type,
        reviewNote: spec.reviewNote,
        familySharable: spec.familySharable,
      },
      relationships: { app: { data: { type: 'apps', id: appId } } },
    },
  });
  const id = iap.data.id;
  console.log(`  created ${p.productId} (id ${id})`);

  await api('POST', '/v1/inAppPurchaseLocalizations', {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: { locale: spec.locale, name: p.displayName, description: p.description },
      relationships: { inAppPurchaseV2: { data: { type: 'inAppPurchases', id } } },
    },
  });
  console.log(`  localized ${spec.locale}: "${p.displayName}"`);

  const points = await getAll(`/v2/inAppPurchases/${id}/pricePoints?filter[territory]=${spec.baseTerritory}&limit=200`);
  const point = findPricePoint(points, p.priceUsd);
  if (!point) throw new Error(`${p.productId}: no ${spec.baseTerritory} price point for ${p.priceUsd}`);
  await api('POST', '/v1/inAppPurchasePriceSchedules', {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id } },
        baseTerritory: { data: { type: 'territories', id: spec.baseTerritory } },
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price0}' }] },
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: '${price0}',
        attributes: { startDate: null },
        relationships: {
          inAppPurchaseV2: { data: { type: 'inAppPurchases', id } },
          inAppPurchasePricePoint: { data: { type: 'inAppPurchasePricePoints', id: point.id } },
        },
      },
    ],
  });
  console.log(`  priced ${spec.baseTerritory} $${p.priceUsd}`);

  await api('POST', '/v1/inAppPurchaseAvailabilities', {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        inAppPurchase: { data: { type: 'inAppPurchases', id } },
        availableTerritories: { data: territories.map((t) => ({ type: 'territories', id: t.id })) },
      },
    },
  });
  console.log(`  available in ${territories.length} territories`);
}

async function main() {
  const args = process.argv.slice(2);
  const appId = args[args.indexOf('--app') + 1];
  const apply = args.includes('--apply');
  if (!/^\d{1,20}$/.test(appId ?? '')) { console.error('--app <numeric ASC app id> is required.'); process.exit(2); }
  for (const k of ['ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY']) {
    if (!process.env[k]) { console.error(`Missing ${k} (GitHub Actions secret).`); process.exit(2); }
  }

  const spec = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf8'));
  const problems = validateProducts(spec);
  if (problems.length) { console.error(`Product file invalid:\n- ${problems.join('\n- ')}`); process.exit(2); }

  const existing = await getAll(`/v1/apps/${appId}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,state`);
  const have = new Map(existing.map((r) => [r.attributes.productId, r.attributes.state]));
  const todo = spec.products.filter((p) => !have.has(p.productId));
  const territories = await getAll('/v1/territories?limit=200');

  console.log(`App ${appId}: ${existing.length} existing in-app purchases, ${territories.length} territories.`);
  for (const p of spec.products) {
    const state = have.get(p.productId);
    console.log(`${state ? 'SKIP (exists, ' + state + ')' : apply ? 'CREATE' : 'WOULD CREATE'}  ${p.productId}  $${p.priceUsd}  "${p.displayName}"`);
  }
  if (!apply) { console.log('Dry run: nothing written. Re-run with apply=true to create.'); return; }

  const failed = [];
  for (const p of todo) {
    console.log(`${p.productId}:`);
    try { await createOne(appId, spec, p, territories); } catch (e) { console.log(`  FAILED: ${e.message}`); failed.push(p.productId); }
  }
  console.log(`Done: ${todo.length - failed.length} created, ${spec.products.length - todo.length} skipped, ${failed.length} failed.`);
  if (failed.length) {
    console.log(`Failed products may be partly created; finish them in App Store Connect: ${failed.join(', ')}`);
    process.exit(1);
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((e) => { console.error(e.message); process.exit(1); });
