import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, hasPaidContent } from '../../constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '../../constants/iosV1';
import {
  ENTITLEMENT_ALL,
  PRODUCT_ALL,
  PRICE_ALL_MICROS,
  PRICE_CATEGORY_MICROS,
  buildCatalog,
  entitlementForCategory,
  isCategoryEntitled,
  productForCategory,
} from '../../lib/catalog';

test('catalog has the pack plus one product per paid category', () => {
  const catalog = buildCatalog();
  const paid = CATEGORIES.filter((c) => hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id));
  assert.equal(catalog.length, 1 + paid.length);
  assert.equal(catalog[0].productId, PRODUCT_ALL);
  assert.equal(catalog[0].priceMicros, PRICE_ALL_MICROS);
  for (const c of paid) {
    const p = catalog.find((x) => x.categoryId === c.id);
    assert.ok(p, `missing product for ${c.id}`);
    assert.equal(p.priceMicros, PRICE_CATEGORY_MICROS);
    assert.equal(p.entitlementId, entitlementForCategory(c.id));
  }
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
  assert.equal(buildCatalog().length, 8); // pack + 7 categories
});
