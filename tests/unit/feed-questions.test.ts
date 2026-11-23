import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEED_QUESTIONS, FEED_CATEGORIES, isFeedQuestion } from '../../lib/feedQuestions';
import { CATEGORIES, QUESTIONS, getCategoryAudience } from '../../constants/questions';

const adult = (category: string) => getCategoryAudience(category) === 'adult';

test('the mixed feed lists no kids or teen question', () => {
  assert.ok(FEED_QUESTIONS.length > 0);
  assert.equal(FEED_QUESTIONS.filter((q) => !adult(q.category) || q.id.startsWith('kf-') || q.id.startsWith('tn-')).length, 0);
});

test('the feed keeps every adult question', () => {
  const adults = QUESTIONS.filter((q) => adult(q.category));
  assert.equal(FEED_QUESTIONS.length, adults.length);
  assert.ok(QUESTIONS.length > FEED_QUESTIONS.length, 'kids questions exist and are excluded');
});

test('the category filter row has only adult categories', () => {
  assert.deepEqual(FEED_CATEGORIES.map((c) => c.id), CATEGORIES.filter((c) => c.audience === 'adult').map((c) => c.id));
  assert.ok(FEED_CATEGORIES.length > 0);
});

test('isFeedQuestion reads the category audience', () => {
  const kids = CATEGORIES.find((c) => c.audience === 'kids')!;
  assert.equal(isFeedQuestion({ category: kids.id }), false);
  assert.equal(isFeedQuestion({ category: 'silly-bad' } as any), false); // not a category: not shown
  assert.equal(isFeedQuestion({ category: CATEGORIES.find((c) => c.audience === 'adult')!.id }), true);
});
