import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { planTextUpdates, EDITABLE_STATES } from '../../scripts/asc-iap-update.mjs';
// @ts-ignore plain .mjs module
import { validateProducts } from '../../scripts/asc-iap-create.mjs';
import { CATEGORIES, getTranches, trancheSize } from '../../constants/questions';
import { productForCategory } from '../../lib/catalog';

const spec = JSON.parse(readFileSync('store/ios/iap-products.json', 'utf8'));
const row = (productId: string, over: Record<string, unknown> = {}) => ({ id: 'i1', state: 'READY_TO_SUBMIT', locId: 'l1', name: 'x', description: 'y', ...over });
const one = (productId: string) => ({ ...spec, products: spec.products.filter((p: any) => p.productId === productId) });

test('the product text says what a purchase opens: the next tranche, sized from the data (#252)', () => {
  assert.deepEqual(validateProducts(spec), []);
  for (const c of CATEGORIES.filter((c) => c.audience === 'adult')) {
    const p = spec.products.find((x: any) => x.productId === productForCategory(c.id));
    if (!p) continue;
    const first = getTranches(c)[0];
    assert.equal(p.description, `Unlock ${trancheSize(first)} more questions in ${c.label}`, c.id);
    assert.doesNotMatch(p.description, /every question/i, c.id);
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
