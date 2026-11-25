import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, getTranches, hasPaidContent } from '../../constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '../../constants/iosV1';
import {
  ENTITLEMENT_ALL,
  PRODUCT_ALL,
  PRICE_ALL_MICROS,
  PRICE_CATEGORY_MICROS,
  buildCatalog,
  entitlementForCategory,
  entitlementForTranche,
  isCategoryEntitled,
  productForCategory,
  productForTranche,
} from '../../lib/catalog';

test('catalog has the pack plus one product per paid tranche of each category', () => {
  const catalog = buildCatalog();
  const paid = CATEGORIES.filter((c) => hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id));
  assert.equal(catalog[0].productId, PRODUCT_ALL);
  assert.equal(catalog[0].priceMicros, PRICE_ALL_MICROS);
  let tranches = 0;
  for (const c of paid) {
    for (const t of getTranches(c)) {
      tranches++;
      const p = catalog.find((x) => x.categoryId === c.id && x.tranche === t.k);
      assert.ok(p, `missing product for ${c.id} tranche ${t.k}`);
      assert.equal(p.productId, productForTranche(c.id, t.k));
      assert.equal(p.priceMicros, PRICE_CATEGORY_MICROS);
      assert.equal(p.entitlementId, entitlementForTranche(c.id, t.k));
    }
  }
  assert.equal(catalog.length, 1 + tranches);
});

test('26 products: pack, 7 grown-up (tranche 1), 4 grown-up part 2, 14 kids and teen (#252)', () => {
  const catalog = buildCatalog();
  const young = catalog.filter((p) => p.categoryId && CATEGORIES.find((c) => c.id === p.categoryId)!.audience !== 'adult');
  const adult1 = catalog.filter((p) => p.categoryId && p.tranche === 1 && CATEGORIES.find((c) => c.id === p.categoryId)!.audience === 'adult');
  const adult2 = catalog.filter((p) => p.categoryId && (p.tranche ?? 0) >= 2 && CATEGORIES.find((c) => c.id === p.categoryId)!.audience === 'adult');
  assert.deepEqual([adult1.length, adult2.length, young.length, catalog.length], [7, 4, 14, 26]);
  assert.deepEqual(adult2.map((p) => p.productId).sort(), ['wyr_unlock_career_climber_2', 'wyr_unlock_moral_compass_2', 'wyr_unlock_social_blunders_2', 'wyr_unlock_tech_dystopia_2']);
  // Tranche 1 keeps the ids and entitlements that exist today.
  assert.equal(productForTranche('high-life', 1), 'wyr_unlock_high_life');
  assert.equal(entitlementForTranche('high-life', 1), 'cat_high-life');
  assert.equal(productForTranche('tech-dystopia', 2), 'wyr_unlock_tech_dystopia_2');
  assert.equal(entitlementForTranche('tech-dystopia', 2), 'cat_tech-dystopia_2');
});

test('product text fits App Store Connect limits (name 30, description 45) and names the tranche size', () => {
  for (const p of buildCatalog()) {
    assert.ok(p.title.length <= 30, `${p.productId} title`);
    assert.ok(p.description.length <= 45, `${p.productId} description`);
  }
  const td2 = buildCatalog().find((p) => p.productId === 'wyr_unlock_tech_dystopia_2')!;
  assert.equal(td2.description, 'Unlock 20 more questions in Tech Dystopia');
});

test('approved prices (Tim, 2026-11-18): $4.99 pack, $1.99 category', () => {
  assert.equal(PRICE_ALL_MICROS, 4_990_000);
  assert.equal(PRICE_CATEGORY_MICROS, 1_990_000);
});

test('free categories with no paid content are not for sale; the retired Kids & Family category has no product', () => {
  assert.equal(buildCatalog().some((p) => (p.categoryId as string) === 'kids-family'), false);
});

test('identifiers are stable and store-safe', () => {
  assert.equal(productForCategory('high-life'), 'wyr_unlock_high_life');
  assert.equal(entitlementForCategory('high-life'), 'cat_high-life');
  for (const p of buildCatalog()) assert.match(p.productId, /^[a-z0-9_]+$/);
  assert.equal(new Set(buildCatalog().map((p) => p.productId)).size, buildCatalog().length);
});

test('access: pack opens every category, category unlock opens only itself', () => {
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'high-life'), true);
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'a-category-added-later'), true);
  assert.equal(isCategoryEntitled([entitlementForCategory('high-life')], 'high-life'), true);
  assert.equal(isCategoryEntitled([entitlementForCategory('high-life')], 'deep-desires'), false);
  assert.equal(isCategoryEntitled(new Set<string>(), 'high-life'), false);
});

test('iOS v1 leaves Midnight Secrets and Deep Desires out (Tim, 2026-11-18): no products for them', () => {
  assert.deepEqual([...IOS_V1_EXCLUDED_CATEGORIES].sort(), ['deep-desires', 'midnight-secrets']);
  const ids = buildCatalog().map((p) => p.productId);
  assert.equal(ids.includes('wyr_unlock_midnight_secrets'), false);
  assert.equal(ids.includes('wyr_unlock_deep_desires'), false);
  assert.equal(buildCatalog().filter((p) => p.tranche === 1 && p.categoryId && CATEGORIES.find((c) => c.id === p.categoryId)!.audience === 'adult').length, 7); // 7 grown-up categories ship
});
