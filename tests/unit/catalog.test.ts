import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, hasPaidContent } from '../../constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '../../constants/iosV1';
import {
  ENTITLEMENT_ALL,
  PRODUCT_ALL,
  PRICE_ALL_MICROS,
  PRICE_CATEGORY_MICROS,
  PRICE_TRANCHE_MICROS,
  buildCatalog,
  entitlementForCategory,
  entitlementForTranche,
  isCategoryEntitled,
  productForCategory,
  productForTranche,
} from '../../lib/catalog';
import { trancheRanges } from '../../lib/tranches';

const adultPaid = CATEGORIES.filter((c) => c.audience === 'adult' && hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id));
const young = CATEGORIES.filter((c) => c.audience !== 'adult' && hasPaidContent(c));

test('catalog: the one all-categories pack, one product per adult paid category, and one product per kids or teen step after the 5 free questions', () => {
  const catalog = buildCatalog();
  assert.equal(adultPaid.length, 7);
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).length, 0), 9);
  assert.equal(catalog.length, 1 + adultPaid.length + 9); // 17
  assert.equal(catalog[0].productId, PRODUCT_ALL);
  assert.equal(catalog[0].priceMicros, PRICE_ALL_MICROS);
  for (const c of adultPaid) {
    const p = catalog.find((x) => x.categoryId === c.id && x.trancheIndex === null);
    assert.ok(p, `missing product for ${c.id}`);
    assert.equal(p.priceMicros, PRICE_CATEGORY_MICROS);
    assert.equal(p.entitlementId, entitlementForCategory(c.id));
  }
  for (const c of young) {
    for (const r of trancheRanges(c)) {
      const p = catalog.find((x) => x.productId === productForTranche(c.id, r.k));
      assert.ok(p, `missing tranche product ${c.id} ${r.k}`);
      assert.equal(p.priceMicros, PRICE_TRANCHE_MICROS);
      assert.equal(p.entitlementId, entitlementForTranche(c.id, r.k));
      assert.equal(p.trancheIndex, r.k);
      assert.equal(p.trancheSize, r.size);
    }
  }
});

test('approved prices (Tim, 2026-11-18): $4.99 pack, $1.99 category; 2026-11-24: $1.99 per tranche', () => {
  assert.equal(PRICE_ALL_MICROS, 4_990_000);
  assert.equal(PRICE_CATEGORY_MICROS, 1_990_000);
  assert.equal(PRICE_TRANCHE_MICROS, 1_990_000);
});

test('there is ONE pack for everything (Tim, 2026-11-24): no separate With kids pack exists', () => {
  const ids = buildCatalog().map((p) => p.productId);
  assert.equal(ids.includes('wyr_premium_kids'), false);
  assert.equal(buildCatalog().filter((p) => p.categoryId === null).length, 1);
  assert.equal(buildCatalog().find((p) => p.categoryId === null)!.productId, PRODUCT_ALL);
});

test('free categories with no paid content are not for sale; the retired Kids & Family category has no product', () => {
  assert.equal(buildCatalog().some((p) => (p.categoryId as string) === 'kids-family'), false);
});

test('identifiers are stable and store-safe', () => {
  assert.equal(productForCategory('high-life'), 'wyr_unlock_high_life');
  assert.equal(entitlementForCategory('high-life'), 'cat_high-life');
  assert.equal(productForTranche('giggle-factory', 2), 'wyr_unlock_giggle_factory_2');
  assert.equal(entitlementForTranche('giggle-factory', 2), 'cat_giggle-factory_2');
  for (const p of buildCatalog()) assert.match(p.productId, /^[a-z0-9_]+$/);
  assert.equal(new Set(buildCatalog().map((p) => p.productId)).size, buildCatalog().length);
  assert.equal(new Set(buildCatalog().map((p) => p.entitlementId)).size, buildCatalog().length);
});

test('App Store Connect field limits hold for the tranche names (title 30, description 45)', () => {
  for (const p of buildCatalog().filter((x) => x.trancheIndex !== null)) {
    assert.ok(p.title.length <= 30, `${p.productId} title "${p.title}"`);
    assert.ok(p.description.length <= 45, `${p.productId} description "${p.description}"`);
  }
});

test('the all-categories pack keeps its name: it now covers every category, adult, kids and teen', () => {
  const pack = buildCatalog().find((p) => p.productId === PRODUCT_ALL)!;
  assert.equal(pack.title, 'All Categories');
  assert.equal(pack.description, 'Opens the next 20 in every category.');
});

test('access: pack opens every adult category, category unlock opens only itself', () => {
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'high-life'), true);
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'a-category-added-later'), true);
  assert.equal(isCategoryEntitled([entitlementForCategory('high-life')], 'high-life'), true);
  assert.equal(isCategoryEntitled([entitlementForCategory('high-life')], 'deep-desires'), false);
  assert.equal(isCategoryEntitled(new Set<string>(), 'high-life'), false);
});

test('access: the one pack opens every category, kids and teen included, until 4c limits it to step 1 (see tranches.test.ts)', () => {
  for (const c of young) {
    assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], c.id), true, c.id);
    assert.equal(isCategoryEntitled([], c.id), false, c.id);
  }
});

test('iOS v1 leaves Midnight Secrets and Deep Desires out (Tim, 2026-11-18): no products for them', () => {
  assert.deepEqual([...IOS_V1_EXCLUDED_CATEGORIES].sort(), ['deep-desires', 'midnight-secrets']);
  const ids = buildCatalog().map((p) => p.productId);
  assert.equal(ids.includes('wyr_unlock_midnight_secrets'), false);
  assert.equal(ids.includes('wyr_unlock_deep_desires'), false);
  assert.equal(buildCatalog().length, 17); // pack + 7 adult categories + 9 kids and teen steps (one per category)
});
