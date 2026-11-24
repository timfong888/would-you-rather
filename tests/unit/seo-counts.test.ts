// Tim, 2026-11-24: "Let's not compromise SEO." The in-app free count (N) must never shrink what search engines see.
// These are FLOORS taken from `main` on 2026-11-24: the questions listed on each SEO landing page, the number of
// playable-question URLs in the sitemap, and the sitemap size. Changing the free count (UNIFORM_FREE_COUNT_LIVE, 4c) makes
// them fail until SEO is decoupled from the free count (the public pages list every question; issue "SEO landing pages").
// Raising a floor is fine; lowering one needs Tim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, getCategoryQuestions, isQuestionLocked } from '../../constants/questions';
import { SEO_PAGES, getSeoPageQuestions } from '../../constants/seoPages';

const PAGE_FLOOR: Record<string, number> = {
  'would-you-rather-questions-for-kids': 25,
  'funny-would-you-rather-questions-for-kids': 20,
  'would-you-rather-questions-for-kindergarten': 20,
  'would-you-rather-questions-for-elementary-students': 20,
  'gross-would-you-rather-questions': 15,
  'this-or-that-questions-for-kids': 20,
  'thanksgiving-would-you-rather-questions': 15,
  'christmas-would-you-rather-questions-for-kids': 18,
  'would-you-rather-questions-for-family': 20,
  'dinner-table-conversation-starters': 20,
  'road-trip-would-you-rather-questions': 20,
  'would-you-rather-app': 10,
  'deep-would-you-rather-questions': 15,
  'questions-for-couples': 20,
};

test('SEO landing pages list at least as many questions as on main (2026-11-24)', () => {
  assert.deepEqual(SEO_PAGES.map((p) => p.slug).sort(), Object.keys(PAGE_FLOOR).sort(), 'a page was added or removed: update the floors');
  for (const p of SEO_PAGES) assert.ok(getSeoPageQuestions(p).length >= PAGE_FLOOR[p.slug], `${p.slug} lists ${getSeoPageQuestions(p).length}, floor ${PAGE_FLOOR[p.slug]}`);
});

test('the sitemap keeps at least 167 playable-question URLs and 202 URLs in all (scripts/generate-sitemap.ts rule: not locked)', () => {
  let games = 0;
  for (const c of CATEGORIES) getCategoryQuestions(c.id).forEach((_, i) => { if (!isQuestionLocked(c, i, false)) games++; });
  assert.ok(games >= 167, `${games} playable-question URLs, floor 167`);
  const fixed = 3 + CATEGORIES.length + SEO_PAGES.length; // /, /categories, /kids, one per category, one per SEO page
  assert.equal(fixed, 35);
  assert.ok(fixed + games >= 202, `sitemap would have ${fixed + games} URLs, floor 202`);
});
