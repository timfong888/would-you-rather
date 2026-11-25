/**
 * Product catalog and access rule, shared by the app, the tests and
 * scripts/revenuecat/sync-catalog.ts. Pure: no React Native imports.
 *
 * Tim's decisions: one all-categories pack plus an unlock per category (2026-11-18, issue #54); one product per
 * category with no tranches (2026-11-25, D22, #255). Prices: pack $4.99, single category $1.99.
 *
 * Identifiers are identical in RevenueCat (Test Store), App Store Connect and
 * Google Play, so changing one is a catalog migration, not a code tweak.
 */
import { CATEGORIES, hasPaidContent } from '@/constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '@/constants/iosV1';
import type { CategoryDef, CategoryId } from '@/constants/questions';

/** Entitlement that opens every paid category, including ones added later. */
export const ENTITLEMENT_ALL = 'premium_all';

/** Store product identifier for the all-categories pack. */
export const PRODUCT_ALL = 'wyr_premium_all';

/** Display prices, USD micros. The store price (from the offering) wins in the UI. */
export const PRICE_ALL_MICROS = 4_990_000;
export const PRICE_CATEGORY_MICROS = 1_990_000;
export const FALLBACK_PRICE_ALL = '$4.99';
export const FALLBACK_PRICE_CATEGORY = '$1.99';

/** RevenueCat offering that holds every package. One offering, one package per product. */
export const OFFERING_ID = 'default';

export function entitlementForCategory(id: CategoryId | string): string {
  return `cat_${id}`;
}

export function productForCategory(id: CategoryId | string): string {
  return `wyr_unlock_${String(id).replace(/-/g, '_')}`;
}

/**
 * Categories that have something to sell (premium, or an expansion pack) in
 * the iOS v1 store catalog. Midnight Secrets and Deep Desires are left out of
 * iOS v1 (Tim, 2026-11-18), so no product exists for them.
 */
export function paidCategories(categories: CategoryDef[] = CATEGORIES): CategoryDef[] {
  return categories.filter((c) => hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id));
}

/**
 * The whole rule: a category is open if the all-categories entitlement is
 * active OR that category's own entitlement is.
 */
export function isCategoryEntitled(active: ReadonlySet<string> | readonly string[], id: CategoryId | string): boolean {
  const set = active instanceof Set ? active : new Set(active as readonly string[]);
  return set.has(ENTITLEMENT_ALL) || set.has(entitlementForCategory(id));
}

export interface CatalogProduct {
  productId: string;
  entitlementId: string;
  title: string;
  description: string;
  priceMicros: number;
  /** null for the all-categories pack. */
  categoryId: CategoryId | null;
}

/**
 * Every product to create, derived from the question bank so it cannot drift: the pack plus one product per paid
 * category (D22, #255). A category product opens every question after the free ones. Grown-up, kids and teen share
 * the rule; the pack opens grown-up categories only.
 */
export function buildCatalog(categories: CategoryDef[] = CATEGORIES): CatalogProduct[] {
  const products: CatalogProduct[] = [
    {
      productId: PRODUCT_ALL,
      entitlementId: ENTITLEMENT_ALL,
      title: 'All Grown-up Categories',
      description: 'All grown-up categories, plus future ones',
      priceMicros: PRICE_ALL_MICROS,
      categoryId: null,
    },
  ];
  for (const c of paidCategories(categories)) {
    products.push({
      productId: productForCategory(c.id),
      entitlementId: entitlementForCategory(c.id),
      title: c.label,
      description: `Unlock all of ${c.label}`,
      priceMicros: PRICE_CATEGORY_MICROS,
      categoryId: c.id,
    });
  }
  return products;
}
