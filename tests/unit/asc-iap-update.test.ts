import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { planTextUpdates, EDITABLE_STATES } from '../../scripts/asc-iap-update.mjs';
// @ts-ignore plain .mjs module
import { validateProducts } from '../../scripts/asc-iap-create.mjs';
import { CATEGORIES } from '../../constants/questions';
import { productForCategory } from '../../lib/catalog';

const spec = JSON.parse(readFileSync('store/ios/iap-products.json', 'utf8'));
const row = (productId: string, over: Record<string, unknown> = {}) => ({ id: 'i1', state: 'READY_TO_SUBMIT', locId: 'l1', name: 'x', description: 'y', ...over });
const one = (productId: string) => ({ ...spec, products: spec.products.filter((p: any) => p.productId === productId) });

test('the product text says what a purchase opens: all of the category (D22, #255)', () => {
  assert.deepEqual(validateProducts(spec), []);
  for (const c of CATEGORIES.filter((c) => c.audience === 'adult')) {
    const p = spec.products.find((x: any) => x.productId === productForCategory(c.id));
    if (!p) continue;
    assert.equal(p.description, `Unlock all of ${c.label}`, c.id);
  }
  const pack = spec.products.find((x: any) => x.productId === 'wyr_premium_all');
  assert.match(pack.displayName + pack.description, /grown-up/i);
});

test('plan: changed text updates, equal text is left, missing product is not created here', () => {
  const p = spec.products[1];
  const old = row(p.productId);
  const plan = planTextUpdates(one(p.productId), new Map([[p.productId, old]]));
  assert.equal(plan[0].action, 'update');
  assert.deepEqual(plan[0].after, { name: p.displayName, description: p.description });
  assert.equal(plan[0].locId, 'l1');
  const same = planTextUpdates(one(p.productId), new Map([[p.productId, row(p.productId, { name: p.displayName, description: p.description })]]));
  assert.equal(same[0].action, 'same');
  assert.equal(planTextUpdates(one(p.productId), new Map())[0].action, 'absent');
});

test('plan: only editable states are touched; others are reported and skipped', () => {
  const p = spec.products[1];
  for (const state of ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'REMOVED_FROM_SALE']) {
    assert.equal(planTextUpdates(one(p.productId), new Map([[p.productId, row(p.productId, { state })]]))[0].action, 'skip-state', state);
  }
  for (const state of EDITABLE_STATES) {
    assert.equal(planTextUpdates(one(p.productId), new Map([[p.productId, row(p.productId, { state })]]))[0].action, 'update', state);
  }
  assert.equal(planTextUpdates(one(p.productId), new Map([[p.productId, row(p.productId, { locId: null })]]))[0].action, 'no-localization');
});

test('the script writes only localization text, behind --apply, and the workflow needs a confirm string', () => {
  const src = readFileSync('scripts/asc-iap-update.mjs', 'utf8');
  const writes = [...src.matchAll(/api\('(POST|PATCH|PUT|DELETE)',\s*`([^`]+)`/g)].map((m) => `${m[1]} ${m[2].replace(/\$\{[^}]+\}/g, '{id}')}`);
  assert.deepEqual(writes, ['PATCH /v1/inAppPurchaseLocalizations/{id}']);
  assert.match(src, /if \(!apply\) \{ console\.log\([^\n]*return; \}/);
  const wf = readFileSync('.github/workflows/apple-iap-update.yml', 'utf8');
  assert.match(wf, /inputs\.apply && inputs\.confirm != 'UPDATE-IAP-TEXT'/);
  assert.match(wf, /default: false/);
});

// ---- D22 (#255): the dry runs against App Store Connect's 8 existing products ----
const EXISTING_8 = ['wyr_premium_all', 'wyr_unlock_high_life', 'wyr_unlock_moral_compass', 'wyr_unlock_social_blunders', 'wyr_unlock_time_traveler', 'wyr_unlock_career_climber', 'wyr_unlock_tech_dystopia', 'wyr_unlock_wildest_dreams'];

test('create dry run: 8 of the 17 products exist (SKIP), 9 are new (WOULD CREATE), all kids and teen', () => {
  const ids = spec.products.map((p: any) => p.productId);
  assert.equal(ids.length, 17);
  for (const id of EXISTING_8) assert.ok(ids.includes(id), id);
  const fresh = ids.filter((id: string) => !EXISTING_8.includes(id));
  assert.equal(fresh.length, 9);
  for (const id of fresh) {
    const c = CATEGORIES.find((x) => productForCategory(x.id) === id)!;
    assert.notEqual(c.audience, 'adult', id);
  }
});

test('text update dry run: the 8 existing products change to "Unlock all of <category>", the 9 new ones are absent', () => {
  const old = (p: any) => row(p.productId, p.productId === 'wyr_premium_all' ? { name: p.displayName, description: p.description } : { name: p.displayName, description: 'Unlock 15 more questions in ' + p.displayName });
  const existing = new Map<string, any>(spec.products.filter((p: any) => EXISTING_8.includes(p.productId)).map((p: any) => [p.productId, old(p)]));
  const plan = planTextUpdates(spec, existing);
  const by = (a: string) => plan.filter((x: any) => x.action === a).length;
  assert.deepEqual([by('update'), by('absent'), by('same')], [7, 9, 1], 'the pack text is unchanged; the 7 category products change');
  const hl = plan.find((x: any) => x.productId === 'wyr_unlock_high_life');
  assert.equal(hl.after.description, 'Unlock all of The High Life');
});
