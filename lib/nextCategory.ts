/**
 * The category to suggest after a player finishes one (end-of-category screen, #81).
 * Pure: takes the category list and an "is playable" predicate so it is testable
 * without the app's contexts.
 */
export interface CategoryLike {
  id: string;
  tier: 'free' | 'premium';
}

const KIDS = 'kids-family';

/**
 * Next category in list order after `currentId`, wrapping around, that the player can
 * start without paying (free tier or already unlocked). Never moves a player from the
 * kids category into adult ones, or an adult player into the kids category.
 * Returns null when there is no suitable category.
 */
export function pickNextCategory<T extends CategoryLike>(
  categories: readonly T[],
  currentId: string,
  isUnlocked: (id: string) => boolean,
): T | null {
  if (currentId === KIDS) return null;
  const start = categories.findIndex((c) => c.id === currentId);
  if (start < 0) return null;
  for (let step = 1; step < categories.length; step++) {
    const c = categories[(start + step) % categories.length];
    if (c.id === KIDS) continue;
    if (c.tier === 'free' || isUnlocked(c.id)) return c;
  }
  return null;
}
