import { QUESTIONS, CATEGORIES, getCategoryAudience, type Question } from '@/constants/questions';

/**
 * The mixed /feed is an adult route with analytics and the persisted visitor ID on, so it lists adult
 * categories only: no kids question (Tim's rule: no tracking on kids routes; #96) and no teen question
 * (teen content is browsed in With kids mode, spec §2.1). Kids and teen questions stay reachable from
 * their own categories. Read from `audience`, so a new kids category is excluded automatically.
 */
export function isFeedCategory(categoryId: string): boolean {
  return getCategoryAudience(categoryId) === 'adult';
}

export function isFeedQuestion(q: Pick<Question, 'category'>): boolean {
  return isFeedCategory(q.category);
}

export const FEED_QUESTIONS: Question[] = QUESTIONS.filter(isFeedQuestion);
export const FEED_CATEGORIES = CATEGORIES.filter((c) => isFeedCategory(c.id));
