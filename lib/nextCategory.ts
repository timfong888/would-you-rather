/**
 * The category to suggest after a player finishes one (end-of-category screen, #81).
 * Pure: takes the category list and an "is playable" predicate so it is testable
 * without the app's contexts.
 */
export interface CategoryLike {
  id: string;
  tier: 'free' | 'premium';
  audience: 'adult' | 'kids' | 'teen';
}

/**
 * Next category in list order after `currentId`, wrapping around, that the player can
 * start without paying (free tier or already unlocked). Never moves a player from a
 * kids or teen category into adult ones, or an adult player into a kids or teen category
 * (read from `audience`). Returns null when there is no suitable category.
 */
export function pickNextCategory<T extends CategoryLike>(
  categories: readonly T[],
  currentId: string,
  isUnlocked: (id: string) => boolean,
): T | null {
  const start = categories.findIndex((c) => c.id === currentId);
  if (start < 0 || categories[start].audience !== 'adult') return null;
  for (let step = 1; step < categories.length; step++) {
    const c = categories[(start + step) % categories.length];
    if (c.audience !== 'adult') continue;
    if (c.tier === 'free' || isUnlocked(c.id)) return c;
  }
  return null;
}
