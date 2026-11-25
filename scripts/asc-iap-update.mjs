#!/usr/bin/env node
// Updates the en-US display name and description of in-app purchases that ALREADY exist in App Store Connect,
// so they match store/ios/iap-products.json. WRITES to App Store Connect with --apply. Run only by
// .github/workflows/apple-iap-update.yml, and only with Tim's explicit go (#252).
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-iap-update.mjs --app <ascAppId> [--apply]
//   Without --apply (default): dry run. Only GET requests; prints each product's before and after text.
//   With --apply: PATCH /v1/inAppPurchaseLocalizations/{id} (name, description) for products whose text differs.
// Touches nothing else: not the price, availability, reference name or review state. Products that Apple no longer
// lets you edit (in review, approved, removed) are reported and skipped. Products not in App Store Connect are
// ignored (asc-iap-create.mjs creates those). Never submits anything for review.
import { readFileSync } from 'node:fs';
import { PRODUCTS_FILE, api, getAll, validateProducts } from './asc-iap-create.mjs';

/** States in which App Store Connect accepts a text edit. Anything else is reported and skipped. */
export const EDITABLE_STATES = ['MISSING_METADATA', 'READY_TO_SUBMIT', 'DEVELOPER_ACTION_NEEDED', 'REJECTED'];

/**
 * Decides, per product in the file, what to do. `existing` maps productId to
 * { id, state, locId, name, description } as read from App Store Connect.
 * Returns [{ productId, action: 'update'|'same'|'skip-state'|'absent'|'no-localization', ... }]. Pure.
 */
export function planTextUpdates(spec, existing) {
  return spec.products.map((p) => {
    const e = existing.get(p.productId);
    if (!e) return { productId: p.productId, action: 'absent' };
    if (!EDITABLE_STATES.includes(e.state)) return { productId: p.productId, action: 'skip-state', state: e.state };
    if (!e.locId) return { productId: p.productId, action: 'no-localization', state: e.state };
    if (e.name === p.displayName && e.description === p.description) return { productId: p.productId, action: 'same' };
    return {
      productId: p.productId,
      action: 'update',
      locId: e.locId,
      before: { name: e.name, description: e.description },
      after: { name: p.displayName, description: p.description },
    };
  });
}

async function readExisting(appId, locale) {
  const iaps = await getAll(`/v1/apps/${appId}/inAppPurchasesV2?limit=200&fields[inAppPurchases]=productId,state`);
  const out = new Map();
  for (const r of iaps) {
    const locs = await getAll(`/v2/inAppPurchases/${r.id}/inAppPurchaseLocalizations?limit=50`);
    const loc = locs.find((l) => l.attributes.locale === locale);
    out.set(r.attributes.productId, {
      id: r.id,
      state: r.attributes.state,
      locId: loc?.id ?? null,
      name: loc?.attributes.name ?? null,
      description: loc?.attributes.description ?? null,
    });
  }
  return out;
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

  const plan = planTextUpdates(spec, await readExisting(appId, spec.locale));
  for (const s of plan) {
    if (s.action === 'update') {
      console.log(`${apply ? 'UPDATE' : 'WOULD UPDATE'}  ${s.productId}\n    now:  "${s.before.name}" / "${s.before.description}"\n    next: "${s.after.name}" / "${s.after.description}"`);
    } else if (s.action === 'skip-state') console.log(`SKIP (state ${s.state}, not editable)  ${s.productId}`);
    else if (s.action === 'no-localization') console.log(`SKIP (no ${spec.locale} localization)  ${s.productId}`);
    else if (s.action === 'absent') console.log(`ABSENT (not in App Store Connect; asc-iap-create makes it)  ${s.productId}`);
    else console.log(`SAME  ${s.productId}`);
  }
  const todo = plan.filter((s) => s.action === 'update');
  if (!apply) { console.log(`Dry run: nothing written. ${todo.length} product(s) would change. Re-run with apply=true to update.`); return; }

  const failed = [];
  for (const s of todo) {
    try {
      await api('PATCH', `/v1/inAppPurchaseLocalizations/${s.locId}`, {
        data: { type: 'inAppPurchaseLocalizations', id: s.locId, attributes: { name: s.after.name, description: s.after.description } },
      });
      console.log(`  updated ${s.productId}`);
    } catch (e) { console.log(`  FAILED ${s.productId}: ${e.message}`); failed.push(s.productId); }
  }
  console.log(`Done: ${todo.length - failed.length} updated, ${failed.length} failed.`);
  if (failed.length) process.exit(1);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((e) => { console.error(e.message); process.exit(1); });
