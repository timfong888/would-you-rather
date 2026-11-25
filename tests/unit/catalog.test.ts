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
import * as catalogModule from '../../lib/catalog';

const paid = CATEGORIES.filter((c) => hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id));
const audienceOf = (categoryId: string | null) => CATEGORIES.find((c) => c.id === categoryId)!.audience;

test('D22 (#255): the catalog is the pack plus one product per paid category, no tranches', () => {
  const catalog = buildCatalog();
  assert.equal(catalog[0].productId, PRODUCT_ALL);
  assert.equal(catalog[0].priceMicros, PRICE_ALL_MICROS);
  for (const c of paid) {
    const mine = catalog.filter((x) => x.categoryId === c.id);
    assert.equal(mine.length, 1, `${c.id} has exactly one product`);
    assert.equal(mine[0].productId, productForCategory(c.id));
    assert.equal(mine[0].entitlementId, entitlementForCategory(c.id));
    assert.equal(mine[0].priceMicros, PRICE_CATEGORY_MICROS);
    assert.equal(mine[0].title, c.label);
  }
  assert.equal(catalog.length, 1 + paid.length);
});

test('17 products: pack, 7 grown-up categories, 9 kids and teen categories', () => {
  const catalog = buildCatalog();
  const adult = catalog.filter((p) => p.categoryId && audienceOf(p.categoryId) === 'adult');
  const young = catalog.filter((p) => p.categoryId && audienceOf(p.categoryId) !== 'adult');
  assert.deepEqual([adult.length, young.length, catalog.length], [7, 9, 17]);
  // The ids that exist today do not change, and no id carries a tranche suffix.
  assert.equal(productForCategory('high-life'), 'wyr_unlock_high_life');
  assert.equal(entitlementForCategory('high-life'), 'cat_high-life');
  for (const p of catalog) assert.doesNotMatch(p.productId, /_\d+$/, p.productId);
  for (const p of catalog) assert.doesNotMatch(p.entitlementId, /_\d+$/, p.entitlementId);
  assert.deepEqual(
    young.map((p) => p.productId).sort(),
    ['wyr_unlock_dinner_table', 'wyr_unlock_future_me', 'wyr_unlock_giggle_factory', 'wyr_unlock_heart_to_heart', 'wyr_unlock_holiday_table', 'wyr_unlock_make_believe', 'wyr_unlock_real_talk', 'wyr_unlock_road_trip_rally', 'wyr_unlock_tiny_choices'],
  );
});

test('the tranche helpers and the tranche field are gone from the catalog', () => {
  assert.equal('productForTranche' in catalogModule, false);
  assert.equal('entitlementForTranche' in catalogModule, false);
  for (const p of buildCatalog()) assert.equal('tranche' in p, false, p.productId);
});

test('product text fits App Store Connect limits (name 30, description 45) and says it opens all of the category', () => {
  for (const p of buildCatalog()) {
    assert.ok(p.title.length <= 30, `${p.productId} title`);
    assert.ok(p.description.length <= 45, `${p.productId} description`);
  }
  const byId = Object.fromEntries(buildCatalog().map((p) => [p.productId, p]));
  assert.equal(byId.wyr_unlock_tech_dystopia.description, 'Unlock all of Tech Dystopia');
  assert.equal(byId.wyr_unlock_high_life.description, 'Unlock all of The High Life');
  for (const p of buildCatalog().filter((x) => x.categoryId)) assert.match(p.description, /^Unlock all of /, p.productId);
});

test('approved prices (Tim, 2026-11-18): $4.99 pack, $1.99 category', () => {
  assert.equal(PRICE_ALL_MICROS, 4_990_000);
  assert.equal(PRICE_CATEGORY_MICROS, 1_990_000);
});

test('free categories with no paid content are not for sale; the retired Kids & Family category has no product', () => {
  assert.equal(buildCatalog().some((p) => (p.categoryId as string) === 'kids-family'), false);
});

test('identifiers are stable and store-safe', () => {
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
});
