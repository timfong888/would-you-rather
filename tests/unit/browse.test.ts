import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, getFreeQuestionCount, getLockedQuestionCount } from '../../constants/questions';
import {
  AGE_BANDS,
  categoriesForBand,
  categoriesForMode,
  formatAges,
  freeMoreHint,
  overlapsBand,
  randomKidsCategories,
} from '../../lib/browse';
import { randomPlayCategories } from '../../lib/nextCategory';
import { isKidsPath } from '../../lib/kidsPaths';

const ids = (cats: { id: string }[]) => cats.map((c) => c.id);
const band = (id: string) => AGE_BANDS.find((b) => b.id === id)!;

test('Grown-ups mode lists adult categories only; With kids lists kids and teen only; together they are everything', () => {
  const grown = categoriesForMode('grownups', CATEGORIES);
  const kids = categoriesForMode('kids', CATEGORIES);
  assert.ok(grown.length >= 7 && kids.length === 9);
  assert.ok(grown.every((c) => c.audience === 'adult'));
  assert.ok(kids.every((c) => c.audience === 'kids' || c.audience === 'teen'));
  assert.deepEqual(ids([...grown, ...kids]).sort(), ids(CATEGORIES).sort());
});

test('the age chips show exactly the categories whose range overlaps them', () => {
  assert.deepEqual(ids(categoriesForBand(CATEGORIES, 'all')).sort(), [
    'dinner-table', 'future-me', 'giggle-factory', 'heart-to-heart', 'holiday-table',
    'make-believe', 'real-talk', 'road-trip-rally', 'tiny-choices',
  ]);
  assert.deepEqual(ids(categoriesForBand(CATEGORIES, '3-5')).sort(), ['giggle-factory', 'holiday-table', 'make-believe', 'road-trip-rally', 'tiny-choices']);
  assert.deepEqual(ids(categoriesForBand(CATEGORIES, '6-9')).sort(), ['dinner-table', 'giggle-factory', 'heart-to-heart', 'holiday-table', 'make-believe', 'road-trip-rally']);
  assert.deepEqual(ids(categoriesForBand(CATEGORIES, '10-12')).sort(), ['dinner-table', 'future-me', 'giggle-factory', 'heart-to-heart', 'holiday-table', 'road-trip-rally']);
  assert.deepEqual(ids(categoriesForBand(CATEGORIES, '13-17')).sort(), ['future-me', 'real-talk']);
});

test('every chip shows something, and no chip ever shows an adult category', () => {
  for (const b of AGE_BANDS) {
    const shown = categoriesForBand(CATEGORIES, b.id);
    assert.ok(shown.length > 0, b.id);
    assert.ok(shown.every((c) => c.audience !== 'adult'), b.id);
  }
});

test('overlap is inclusive at both ends, and an unknown chip shows all', () => {
  assert.equal(overlapsBand([3, 5], band('3-5')), true);
  assert.equal(overlapsBand([5, 10], band('3-5')), true); // touches at 5
  assert.equal(overlapsBand([6, 12], band('3-5')), false);
  assert.equal(overlapsBand([13, 17], band('10-12')), false);
  assert.equal(overlapsBand([11, 17], band('10-12')), true);
  assert.equal(categoriesForBand(CATEGORIES, 'nonsense').length, 9);
});

test('the random pools are scoped per mode: Grown-ups never kids or teen, With kids never adult, and it follows the chip', () => {
  assert.ok(randomPlayCategories(CATEGORIES).every((c) => c.audience === 'adult'));
  for (const b of AGE_BANDS) {
    const pool = randomKidsCategories(CATEGORIES, b.id);
    assert.deepEqual(ids(pool), ids(categoriesForBand(CATEGORIES, b.id)));
    assert.ok(pool.every((c) => c.audience !== 'adult'));
  }
  assert.deepEqual(ids(randomKidsCategories(CATEGORIES, '13-17')).sort(), ['future-me', 'real-talk']);
});

test('age labels: kids and teen categories have one, adult categories do not', () => {
  const by = (id: string) => CATEGORIES.find((c) => c.id === id)!;
  assert.equal(formatAges(by('tiny-choices')), 'Ages 3–5');
  assert.equal(formatAges(by('real-talk')), 'Ages 13–17');
  for (const c of CATEGORIES) assert.equal(formatAges(c) === null, c.audience === 'adult', c.id);
  assert.equal(formatAges({ audience: 'kids', ages: [7, 7] }), 'Age 7');
});

test('the card hint says free and more, with no price and no pack wording, and matches the data', () => {
  assert.equal(freeMoreHint(8, 22), '8 free · 22 more');
  assert.equal(freeMoreHint(8, 0), '8 free');
  for (const c of CATEGORIES.filter((x) => x.audience !== 'adult')) {
    const hint = freeMoreHint(getFreeQuestionCount(c), getLockedQuestionCount(c));
    assert.match(hint, /^8 free · \d+ more$/);
    assert.doesNotMatch(hint, /\$|pack|unlock/i);
  }
});

test('/kids (With kids mode) is a kids route, so nothing is tracked there', () => {
  assert.equal(isKidsPath('/kids'), true);
  assert.equal(isKidsPath('/kids/'), true);
  assert.equal(isKidsPath('/'), false);
  assert.equal(isKidsPath('/categories'), false);
});
