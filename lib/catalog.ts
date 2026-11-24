/**
 * Product catalog and access rule, shared by the app, the tests and
 * scripts/revenuecat/sync-catalog.ts. Pure: no React Native imports.
 *
 * Tim's decision (2026-11-18, issue #54): one all-categories pack plus an
 * unlock per category. Prices: pack $4.99, single category $1.99.
 *
 * Tim, 2026-11-24 (#124, docs/specs/kids-family-categories.md §3.4): one pack for everything, $4.99, `wyr_premium_all`.
 * "Only the first 20 per category come with the pack unlock"; "1.99 buys the next 20 in a category", repeatable. So the
 * pack opens the first 20 questions of every category, and each $1.99 opens the next batch in ONE category. For kids and
 * teen categories that is one non-consumable per tranche beyond question 20 (lib/tranches.ts,
 * constants/trancheAssignments.ts); an adult category stays one tranche on its existing `cat_<id>`. There is no separate
 * With kids pack. The "infinite" generated questions are issue #203, not built, and not in this catalog.
 * STAGING: the pack is not limited to 20 yet (PACK_LIMITED_TO_FIRST_20 in lib/tranches.ts is false) because the live paywall
 * still sells it as "every category"; 4c changes the paywall and flips the flag.
 *
 * Identifiers are identical in RevenueCat (Test Store), App Store Connect and
 * Google Play, so changing one is a catalog migration, not a code tweak.
 */
import { CATEGORIES, getCategoryAudience, getCategoryById, hasPaidContent } from '@/constants/questions';
import { IOS_V1_EXCLUDED_CATEGORIES } from '@/constants/iosV1';
import type { CategoryDef, CategoryId } from '@/constants/questions';
import { isCategoryFullyOpen, trancheRanges } from './tranches';
import type { Access } from './tranches';

/** Entitlement of the one all-categories pack: the first 20 questions of every category, adult, kids and teen (Tim, 2026-11-24). */
export const ENTITLEMENT_ALL = 'premium_all';

/** Store product identifier for the one all-categories pack. */
export const PRODUCT_ALL = 'wyr_premium_all';

/** Display prices, USD micros. The store price (from the offering) wins in the UI. */
export const PRICE_ALL_MICROS = 4_990_000;
export const PRICE_CATEGORY_MICROS = 1_990_000;
/** One kids or teen tranche. Same $1.99 as a category (Tim, 2026-11-24). */
export const PRICE_TRANCHE_MICROS = 1_990_000;
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
 * What the active entitlements give in one category. `pack` is the all-categories pack (the first 20 questions once the
 * pack is limited, everything until then, see lib/tranches.ts). Adult: the category's own `cat_<id>` is its one tranche.
 * Kids and teen: each owned `cat_<id>_<k>` is tranche k. (Until 4c: the legacy `cat_<id>` also opens a whole kids or
 * teen category, because the live paywall still sells it.)
 */
export function accessFor(active: ReadonlySet<string> | readonly string[], category: CategoryDef): Access {
  const set = active instanceof Set ? active : new Set(active as readonly string[]);
  const pack = set.has(ENTITLEMENT_ALL);
  if (category.audience === 'adult') {
    // An adult category is one tranche, granted by the existing `cat_<id>`.
    return { all: false, pack, ownedTranches: set.has(entitlementForCategory(category.id)) ? new Set([1]) : new Set() };
  }
  const owned = new Set<number>();
  for (const r of trancheRanges(category)) {
    if (set.has(entitlementForTranche(category.id, r.k))) owned.add(r.k);
  }
  // STAGING: the live paywall (app/unlock/[id].tsx) still sells the per-category unlock `cat_<id>` on kids and teen
  // categories, so until 4c changes that paywall to sell tranches, `cat_<id>` keeps opening the whole category and a
  // purchase never stops opening what it was bought for. 4c decides whether such legacy holders are grandfathered.
  return { all: set.has(entitlementForCategory(category.id)), pack, ownedTranches: owned };
}

/**
 * Whether a category is entirely open: nothing left to buy. Decided by the access model (lib/tranches.ts), so it follows
 * the pack limit. An id that is not a category is treated as adult: the pack or its own entitlement opens it.
 */
export function isCategoryEntitled(active: ReadonlySet<string> | readonly string[], id: CategoryId | string): boolean {
  const set = active instanceof Set ? active : new Set(active as readonly string[]);
  const category = getCategoryById(id as CategoryId);
  if (category) return isCategoryFullyOpen(category, accessFor(set, category));
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
      title: 'All Categories',
      description: 'Every category, including questions added later.',
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
