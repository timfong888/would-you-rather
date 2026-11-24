/**
 * Product catalog and access rule, shared by the app, the tests and
 * scripts/revenuecat/sync-catalog.ts. Pure: no React Native imports.
 *
 * Tim's decision (2026-11-18, issue #54): one all-categories pack plus an
 * unlock per category. Prices: pack $4.99, single category $1.99.
 *
 * Tim, 2026-11-24 (#124, docs/specs/kids-family-categories.md §3.4): kids and teen categories sell their paid
 * questions in tranches of about 20 at $1.99 each (one non-consumable per tranche), the $4.99 pack covers ADULT
 * categories only, and a separate With kids pack covers every kids and teen tranche. Adult categories are unchanged:
 * their paid set is one tranche, granted by the existing `cat_<id>` entitlement.
 * The With kids pack price is $4.99: Tim wrote "Kids just came 4.99" (2026-11-24), read by the orchestrator as the pack price; pending his confirmation. Same price as the adult pack. FLAGGED ASSUMPTION: the pack names are the orchestrator's defaults.
 *
 * Identifiers are identical in RevenueCat (Test Store), App Store Connect and
 * Google Play, so changing one is a catalog migration, not a code tweak.
 */
import { CATEGORIES, getCategoryAudience, getCategoryById, hasPaidContent } from '@/constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '@/constants/iosV1';
import type { CategoryDef, CategoryId } from '@/constants/questions';
import { isCategoryFullyOpen, trancheRanges } from './tranches';
import type { Access } from './tranches';

/** Entitlement that opens every ADULT paid category, including ones added later. Never kids or teen categories. */
export const ENTITLEMENT_ALL = 'premium_all';

/** Store product identifier for the adult all-categories pack. */
export const PRODUCT_ALL = 'wyr_premium_all';

/** Entitlement that opens every kids and teen tranche (the With kids pack). Flagged assumption: name. */
export const ENTITLEMENT_KIDS = 'premium_kids';

/** Store product identifier for the With kids pack. Flagged assumption: name. */
export const PRODUCT_KIDS = 'wyr_premium_kids';

/** Display prices, USD micros. The store price (from the offering) wins in the UI. */
export const PRICE_ALL_MICROS = 4_990_000;
export const PRICE_CATEGORY_MICROS = 1_990_000;
/** One kids or teen tranche. Same $1.99 as a category (Tim, 2026-11-24). */
export const PRICE_TRANCHE_MICROS = 1_990_000;
/** The With kids pack: $4.99 per Tim ("Kids just came 4.99", 2026-11-24), pending his confirmation. Same as the adult pack (PRICE_ALL_MICROS). */
export const PRICE_KIDS_MICROS = 4_990_000;
export const FALLBACK_PRICE_ALL = '$4.99';
export const FALLBACK_PRICE_CATEGORY = '$1.99';
export const FALLBACK_PRICE_KIDS = '$4.99';

/** RevenueCat offering that holds every package. One offering, one package per product. */
export const OFFERING_ID = 'default';

export function entitlementForCategory(id: CategoryId | string): string {
  return `cat_${id}`;
}

export function productForCategory(id: CategoryId | string): string {
  return `wyr_unlock_${String(id).replace(/-/g, '_')}`;
}

/** Entitlement of tranche `k` (1-based) of a kids or teen category. */
export function entitlementForTranche(id: CategoryId | string, k: number): string {
  return `cat_${id}_${k}`;
}

/** Store product of tranche `k` (1-based) of a kids or teen category. */
export function productForTranche(id: CategoryId | string, k: number): string {
  return `${productForCategory(id)}_${k}`;
}

/** True for a kids or teen category (sold in tranches, behind the parental gate). Unknown ids are not young. */
export function isYoungCategory(id: CategoryId | string): boolean {
  const audience = getCategoryAudience(String(id));
  return audience === 'kids' || audience === 'teen';
}

/**
 * ADULT categories that have something to sell (premium, or an expansion pack) in the iOS v1 store catalog.
 * Midnight Secrets and Deep Desires are left out of iOS v1 (Tim, 2026-11-18), so no product exists for them.
 * Kids and teen categories are sold in tranches, see `trancheCategories`.
 */
export function paidCategories(categories: CategoryDef[] = CATEGORIES): CategoryDef[] {
  return categories.filter(
    (c) => c.audience === 'adult' && hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id),
  );
}

/** Kids and teen categories that have paid questions, so one or more tranche products. */
export function trancheCategories(categories: CategoryDef[] = CATEGORIES): CategoryDef[] {
  return categories.filter(
    (c) => c.audience !== 'adult' && hasPaidContent(c) && !IOS_V1_EXCLUDED_CATEGORIES.includes(c.id),
  );
}

/**
 * What the active entitlements open in one category. Adult: the all-categories pack or the category's own
 * `cat_<id>` opens its single tranche. Kids and teen: the With kids pack opens everything, otherwise each owned
 * `cat_<id>_<k>` opens tranche k. `premium_all` never opens a kids or teen category.
 */
export function accessFor(active: ReadonlySet<string> | readonly string[], category: CategoryDef): Access {
  const set = active instanceof Set ? active : new Set(active as readonly string[]);
  if (category.audience === 'adult') {
    return { all: set.has(ENTITLEMENT_ALL) || set.has(entitlementForCategory(category.id)), ownedTranches: new Set() };
  }
  const owned = new Set<number>();
  for (const r of trancheRanges(category)) {
    if (set.has(entitlementForTranche(category.id, r.k))) owned.add(r.k);
  }
  return { all: set.has(ENTITLEMENT_KIDS), ownedTranches: owned };
}

/**
 * Whether a category is entirely open: nothing left to buy. An adult category is open with the all-categories
 * pack or its own entitlement; a kids or teen category with the With kids pack or every one of its tranches.
 * An id that is not a category is treated as adult, so a category added later is covered by the pack.
 */
export function isCategoryEntitled(active: ReadonlySet<string> | readonly string[], id: CategoryId | string): boolean {
  const set = active instanceof Set ? active : new Set(active as readonly string[]);
  const category = getCategoryById(id as CategoryId);
  if (category && category.audience !== 'adult') {
    return isCategoryFullyOpen(category, accessFor(set, category));
  }
  return set.has(ENTITLEMENT_ALL) || set.has(entitlementForCategory(id));
}

export interface CatalogProduct {
  productId: string;
  entitlementId: string;
  title: string;
  description: string;
  priceMicros: number;
  /** null for the all-categories pack and the With kids pack. */
  categoryId: CategoryId | null;
  /** The tranche number for a kids or teen tranche product, else null. */
  trancheIndex: number | null;
  /** How many questions the tranche opens, else null. */
  trancheSize: number | null;
}

/** Every product to create, derived from the question bank so it cannot drift. */
export function buildCatalog(categories: CategoryDef[] = CATEGORIES): CatalogProduct[] {
  const products: CatalogProduct[] = [
    {
      productId: PRODUCT_ALL,
      entitlementId: ENTITLEMENT_ALL,
      title: 'All Grown-up Categories',
      description: 'Every adult category, including questions added later.',
      priceMicros: PRICE_ALL_MICROS,
      categoryId: null,
      trancheIndex: null,
      trancheSize: null,
    },
  ];
  for (const c of paidCategories(categories)) {
    products.push({
      productId: productForCategory(c.id),
      entitlementId: entitlementForCategory(c.id),
      title: c.label,
      description: `Every question in ${c.label}, including questions added later.`,
      priceMicros: PRICE_CATEGORY_MICROS,
      categoryId: c.id,
      trancheIndex: null,
      trancheSize: null,
    });
  }
  products.push({
    productId: PRODUCT_KIDS,
    entitlementId: ENTITLEMENT_KIDS,
    title: 'All With Kids Categories',
    description: 'Every kids and teen category, plus new ones',
    priceMicros: PRICE_KIDS_MICROS,
    categoryId: null,
    trancheIndex: null,
    trancheSize: null,
  });
  for (const c of trancheCategories(categories)) {
    const ranges = trancheRanges(c);
    for (const r of ranges) {
      products.push({
        productId: productForTranche(c.id, r.k),
        entitlementId: entitlementForTranche(c.id, r.k),
        title: ranges.length > 1 ? `${c.label}: Part ${r.k}` : c.label,
        description: `The next ${r.size} questions in ${c.label}`,
        priceMicros: PRICE_TRANCHE_MICROS,
        categoryId: c.id,
        trancheIndex: r.k,
        trancheSize: r.size,
      });
    }
  }
  return products;
}
