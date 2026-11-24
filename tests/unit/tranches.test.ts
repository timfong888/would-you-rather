// Unit 4a of #124 (docs/specs/kids-family-categories.md §3.4, docs/specs/plan.md): the pure tranche model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  getCategoryById,
  getCategoryQuestions,
  getFreeQuestionCount,
  isQuestionLocked,
} from '../../constants/questions';
import {
  isCategoryFullyOpen,
  isQuestionOpen,
  nextTrancheToSell,
  noAccess,
  openQuestionCount,
  trancheOf,
  trancheRanges,
  trancheSizes,
} from '../../lib/tranches';
import type { Access } from '../../lib/tranches';
import { ENTITLEMENT_ALL, ENTITLEMENT_KIDS, accessFor, entitlementForCategory, entitlementForTranche, isCategoryEntitled } from '../../lib/catalog';

const young = CATEGORIES.filter((c) => c.audience !== 'adult');
const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const cat = (id: string) => getCategoryById(id as any)!;

test('remainder rule: a remainder under 10 joins the previous tranche, otherwise it is its own', () => {
  assert.deepEqual(trancheSizes(22), [22]);
  assert.deepEqual(trancheSizes(33), [20, 13]);
  assert.deepEqual(trancheSizes(47), [20, 27]);
  assert.deepEqual(trancheSizes(39), [20, 19]);
  assert.deepEqual(trancheSizes(25), [25]);
  assert.deepEqual(trancheSizes(20), [20]);
  assert.deepEqual(trancheSizes(40), [20, 20]);
  assert.deepEqual(trancheSizes(30), [20, 10]); // exactly 10 is its own tranche
  assert.deepEqual(trancheSizes(7), [7]); // nothing before it to join
  assert.deepEqual(trancheSizes(0), []);
});

test('the 12 kids and teen tranches match the spec table (Tim, 2026-11-24)', () => {
  const sizes = Object.fromEntries(young.map((c) => [c.id, trancheRanges(c).map((r) => r.size)]));
  assert.deepEqual(sizes, {
    'tiny-choices': [22],
    'make-believe': [20, 13],
    'giggle-factory': [20, 27],
    'road-trip-rally': [22],
    'dinner-table': [20, 19],
    'heart-to-heart': [22],
    'future-me': [22],
    'real-talk': [22],
    'holiday-table': [25],
  });
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).length, 0), 12);
});

test('tranches start at getFreeQuestionCount, are contiguous, and cover every paid question exactly once', () => {
  for (const c of CATEGORIES) {
    const total = getCategoryQuestions(c.id).length;
    const free = getFreeQuestionCount(c);
    const ranges = trancheRanges(c);
    if (total === free) { assert.deepEqual(ranges, [], c.id); continue; }
    assert.equal(ranges[0].start, free, `${c.id} starts after its own free count`);
    ranges.forEach((r, i) => {
      assert.equal(r.size, r.end - r.start);
      if (i > 0) assert.equal(r.start, ranges[i - 1].end, `${c.id} contiguous`);
    });
    assert.equal(ranges[ranges.length - 1].end, total, `${c.id} ends at the last question`);
  }
});

test('the free count is never a hardcoded 8: adult categories use 3 or 20', () => {
  const frees = new Set(adult.map((c) => getFreeQuestionCount(c)));
  assert.ok([...frees].every((n) => n === 3 || n === 20), [...frees].join());
  for (const c of adult) assert.equal(trancheRanges(c)[0]?.start ?? getFreeQuestionCount(c), getFreeQuestionCount(c), c.id);
});

test('an adult category is exactly one tranche, granted by the existing cat_<id> entitlement (never cat_<id>_1)', () => {
  for (const c of adult) {
    const ranges = trancheRanges(c);
    assert.ok(ranges.length <= 1, `${c.id} is not split`);
    const withCat = accessFor([entitlementForCategory(c.id)], c);
    const withPack = accessFor([ENTITLEMENT_ALL], c);
    const withWrongId = accessFor([`${entitlementForCategory(c.id)}_1`], c);
    assert.equal(withCat.all, true, c.id);
    assert.equal(withPack.all, true, c.id);
    assert.equal(withWrongId.all, false, `${c.id}: cat_<id>_1 must not grant an adult category`);
  }
});

test('adult regression: every adult question is open or locked exactly as the old boolean rule says', () => {
  for (const c of adult) {
    const n = getCategoryQuestions(c.id).length;
    for (let i = 0; i < n; i++) {
      // locked (nothing bought) and unlocked (cat entitlement or pack)
      assert.equal(isQuestionOpen(c, i, accessFor([], c)), !isQuestionLocked(c, i, false), `${c.id} ${i} locked`);
      assert.equal(isQuestionOpen(c, i, accessFor([entitlementForCategory(c.id)], c)), !isQuestionLocked(c, i, true), `${c.id} ${i} cat`);
      assert.equal(isQuestionOpen(c, i, accessFor([ENTITLEMENT_ALL], c)), !isQuestionLocked(c, i, true), `${c.id} ${i} pack`);
    }
  }
});

test('premium_all never opens a kids or teen category beyond its free questions; premium_kids does', () => {
  for (const c of young) {
    const n = getCategoryQuestions(c.id).length;
    const free = getFreeQuestionCount(c);
    const withAll = accessFor([ENTITLEMENT_ALL], c);
    assert.equal(withAll.all, false, c.id);
    for (let i = 0; i < n; i++) assert.equal(isQuestionOpen(c, i, withAll), i < free, `${c.id} ${i}`);
    assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], c.id), false, c.id);
    assert.equal(isCategoryEntitled([ENTITLEMENT_KIDS], c.id), true, c.id);
    assert.equal(openQuestionCount(c, accessFor([ENTITLEMENT_KIDS], c)), n, c.id);
    // an adult-style cat_<id> never opens a kids category either
    assert.equal(accessFor([entitlementForCategory(c.id)], c).all, false, c.id);
  }
});

test('trancheOf and isQuestionOpen at the boundaries (Giggle Factory: 8 free, then 20 and 27)', () => {
  const g = cat('giggle-factory');
  assert.equal(trancheOf(g, 0), 0);
  assert.equal(trancheOf(g, 7), 0);
  assert.equal(trancheOf(g, 8), 1);
  assert.equal(trancheOf(g, 27), 1);
  assert.equal(trancheOf(g, 28), 2);
  assert.equal(trancheOf(g, 54), 2);
  assert.equal(nextTrancheToSell(g, noAccess())?.k, 1);
  const owns1: Access = { all: false, ownedTranches: new Set([1]) };
  assert.equal(isQuestionOpen(g, 27, owns1), true);
  assert.equal(isQuestionOpen(g, 28, owns1), false);
  assert.equal(nextTrancheToSell(g, owns1)?.k, 2);
  assert.equal(nextTrancheToSell(g, { all: false, ownedTranches: new Set([1, 2]) }), null);
  assert.equal(isCategoryFullyOpen(g, { all: false, ownedTranches: new Set([1, 2]) }), true);
});

test('refund example: tranche 1 refunded, tranche 2 still owned opens exactly tranche 2 and the paywall offers tranche 1', () => {
  const g = cat('giggle-factory');
  const access = accessFor([entitlementForTranche('giggle-factory', 2)], g);
  assert.deepEqual([...access.ownedTranches], [2]);
  const n = getCategoryQuestions(g.id).length;
  const open = Array.from({ length: n }, (_, i) => isQuestionOpen(g, i, access));
  open.forEach((o, i) => assert.equal(o, i < 8 || i >= 28, `question ${i}`));
  assert.equal(open.filter(Boolean).length, 8 + 27);
  assert.equal(openQuestionCount(g, access), 8 + 27);
  assert.equal(nextTrancheToSell(g, access)?.k, 1);
  assert.equal(isCategoryFullyOpen(g, access), false);
});

test('an owned tranche set of every tranche fully opens the category without the pack', () => {
  const m = cat('make-believe');
  const access = accessFor([entitlementForTranche('make-believe', 1), entitlementForTranche('make-believe', 2)], m);
  assert.equal(isCategoryFullyOpen(m, access), true);
  assert.equal(isCategoryEntitled([entitlementForTranche('make-believe', 1), entitlementForTranche('make-believe', 2)], 'make-believe'), true);
  assert.equal(isCategoryEntitled([entitlementForTranche('make-believe', 1)], 'make-believe'), false);
});

test('an id that is not a category is treated as adult: the pack covers a category added later', () => {
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'a-category-added-later'), true);
  assert.equal(isCategoryEntitled([], 'a-category-added-later'), false);
});

test('old boolean helpers still exist and behave the same in 4a (callers move in 4b)', () => {
  const g = cat('giggle-factory');
  assert.equal(isQuestionLocked(g, 7, false), false);
  assert.equal(isQuestionLocked(g, 8, false), true);
  assert.equal(isQuestionLocked(g, 8, true), false);
});
