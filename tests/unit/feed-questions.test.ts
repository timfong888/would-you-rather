import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEED_QUESTIONS, FEED_CATEGORIES, isFeedQuestion } from '../../lib/feedQuestions';
import { QUESTIONS } from '../../constants/questions';

test('the mixed feed lists no Kids & Family question', () => {
  assert.ok(FEED_QUESTIONS.length > 0);
  assert.equal(FEED_QUESTIONS.filter((q) => q.category === 'kids-family' || q.id.startsWith('kf-')).length, 0);
});

test('the feed keeps every adult question', () => {
  const adult = QUESTIONS.filter((q) => q.category !== 'kids-family');
  assert.equal(FEED_QUESTIONS.length, adult.length);
  assert.ok(QUESTIONS.length > FEED_QUESTIONS.length, 'kids questions exist and are excluded');
});

test('the category filter row has no Kids & Family chip', () => {
  assert.equal(FEED_CATEGORIES.some((c) => c.id === 'kids-family'), false);
  assert.ok(FEED_CATEGORIES.length > 0);
});

test('isFeedQuestion', () => {
  assert.equal(isFeedQuestion({ category: 'kids-family' }), false);
  assert.equal(isFeedQuestion({ category: 'silly-bad' } as any), true);
});

test('every kf- id is in the kids-family category (so the filter covers them)', () => {
  assert.equal(QUESTIONS.filter((q) => q.id.startsWith('kf-') && q.category !== 'kids-family').length, 0);
});
