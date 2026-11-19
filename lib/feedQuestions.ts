import { QUESTIONS, CATEGORIES, type Question } from '@/constants/questions';

/**
 * The mixed /feed is an adult route with analytics and the persisted visitor ID on, so it must not
 * list Kids & Family questions (Tim's rule: no tracking on kids routes; #96). Kids questions stay
 * reachable from the Kids & Family category, which is a kids route.
 */
export const FEED_EXCLUDED_CATEGORY = 'kids-family';

export function isFeedQuestion(q: Pick<Question, 'category'>): boolean {
  return q.category !== FEED_EXCLUDED_CATEGORY;
}

export const FEED_QUESTIONS: Question[] = QUESTIONS.filter(isFeedQuestion);
export const FEED_CATEGORIES = CATEGORIES.filter((c) => c.id !== FEED_EXCLUDED_CATEGORY);
