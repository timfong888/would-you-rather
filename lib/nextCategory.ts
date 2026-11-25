/**
 * The category to suggest after a player finishes one (end-of-category screen, #81).
 * Pure: takes the category list and an "is playable" predicate so it is testable
 * without the app's contexts.
 */
export interface CategoryLike {
  id: string;
  tier?: 'free' | 'premium';
  audience: 'adult' | 'kids' | 'teen';
}

/**
 * The categories the home "start playing" button may draw from: every adult category (each has free questions,
 * #238). Kids and teen categories are browsed on purpose (spec §2.1); a random tap must never drop a grown-up onto
 * a kids route, which clears their analytics state. Until the With kids mode exists (Unit 3) this is the only guard.
 */
export function randomPlayCategories<T extends CategoryLike>(categories: readonly T[]): T[] {
  return categories.filter((c) => c.audience === 'adult');
}

/**
 * Next adult category in list order after `currentId`, wrapping around. Every adult category has
 * free questions to start with (#238), so none is skipped. Never moves a player from a
 * kids or teen category into adult ones, or an adult player into a kids or teen category
 * (read from `audience`). Returns null when there is no suitable category.
 */
export function pickNextCategory<T extends CategoryLike>(
  categories: readonly T[],
  currentId: string,
  /** @deprecated ignored: every adult category has free questions. Callers drop it in the next step. */
  _isUnlocked?: (id: string) => boolean,
): T | null {
  const start = categories.findIndex((c) => c.id === currentId);
  if (start < 0 || categories[start].audience !== 'adult') return null;
  for (let step = 1; step < categories.length; step++) {
    const c = categories[(start + step) % categories.length];
    if (c.audience === 'adult') return c;
  }
  return null;
}
