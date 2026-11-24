/**
 * Browse modes and age filter (docs/specs/kids-family-categories.md §2.1). Pure: no React, no storage.
 *
 * Two modes: Grown-ups (adult categories only) and With kids (kids and teen categories only). Within With kids, an age
 * chip shows the categories whose age range overlaps it. Nothing here is persisted: the mode is the route (`/kids`
 * is a kids route, see lib/kidsPaths.ts) and the chip is component state.
 */
export type BrowseMode = 'grownups' | 'kids';

export interface BrowseCategory {
  id: string;
  tier: 'free' | 'premium';
  audience: 'adult' | 'kids' | 'teen';
  ages: readonly [number, number];
}

export interface AgeBand {
  id: string;
  label: string;
  /** null = all ages. */
  ages: readonly [number, number] | null;
}

export const AGE_BANDS: readonly AgeBand[] = [
  { id: 'all', label: 'All', ages: null },
  { id: '3-5', label: '3–5', ages: [3, 5] },
  { id: '6-9', label: '6–9', ages: [6, 9] },
  { id: '10-12', label: '10–12', ages: [10, 12] },
  { id: '13-17', label: '13–17', ages: [13, 17] },
];

export const DEFAULT_BAND_ID = 'all';

/** True when the category's age range shares at least one age with the band. */
export function overlapsBand(ages: readonly [number, number], band: AgeBand): boolean {
  if (band.ages === null) return true;
  return ages[0] <= band.ages[1] && ages[1] >= band.ages[0];
}

/** The categories a mode lists: adult for Grown-ups; kids and teen for With kids. */
export function categoriesForMode<T extends BrowseCategory>(mode: BrowseMode, categories: readonly T[]): T[] {
  return categories.filter((c) => (mode === 'grownups' ? c.audience === 'adult' : c.audience !== 'adult'));
}

/** With kids categories the chosen chip shows. An unknown chip id shows all. */
export function categoriesForBand<T extends BrowseCategory>(categories: readonly T[], bandId: string): T[] {
  const band = AGE_BANDS.find((b) => b.id === bandId) ?? AGE_BANDS[0];
  return categoriesForMode('kids', categories).filter((c) => overlapsBand(c.ages, band));
}

/** The categories the With kids "pick one for me" button draws from: what the chip shows. */
export function randomKidsCategories<T extends BrowseCategory>(categories: readonly T[], bandId: string): T[] {
  return categoriesForBand(categories, bandId);
}

/** "Ages 3–5". Adult categories have no label (their range is a placeholder). */
export function formatAges(category: Pick<BrowseCategory, 'audience' | 'ages'>): string | null {
  if (category.audience === 'adult') return null;
  const [min, max] = category.ages;
  return min === max ? `Age ${min}` : `Ages ${min}–${max}`;
}

/** "8 free · 22 more": no price and no pack wording, so it holds under any unlock model. */
export function freeMoreHint(free: number, more: number): string {
  return more > 0 ? `${free} free · ${more} more` : `${free} free`;
}
