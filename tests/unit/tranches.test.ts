// Unit 4a of #124 (docs/specs/kids-family-categories.md §3.4, docs/specs/plan.md): the pure tranche model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  QUESTIONS,
  getCategoryById,
  getCategoryQuestions,
  getFreeQuestionCount,
  isQuestionLocked,
} from '../../constants/questions';
import { TRANCHE_ASSIGNMENTS } from '../../constants/trancheAssignments';
import {
  isCategoryFullyOpen,
  isQuestionOpen,
  nextTrancheToSell,
  noAccess,
  openQuestionCount,
  trancheOf,
  trancheRanges,
  trancheSizes,
  unassignedPaidQuestions,
} from '../../lib/tranches';
import type { Access } from '../../lib/tranches';
import {
  ENTITLEMENT_ALL,
  accessFor,
  entitlementForCategory,
  entitlementForTranche,
  isCategoryEntitled,
} from '../../lib/catalog';

const young = CATEGORIES.filter((c) => c.audience !== 'adult');
const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const cat = (id: string) => getCategoryById(id as any)!;

test('remainder rule (used to define NEW tranches): under 10 joins the previous tranche, otherwise its own', () => {
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

test('frozen membership: every paid kids and teen question is in exactly one tranche, nothing free or unknown is, and no id is duplicated', () => {
  for (const c of young) {
    const qs = getCategoryQuestions(c.id);
    const free = new Set(qs.slice(0, getFreeQuestionCount(c)).map((q) => q.id));
    const paid = qs.slice(getFreeQuestionCount(c)).map((q) => q.id);
    const seen = new Set<string>();
    for (const r of trancheRanges(c)) {
      for (const id of r.ids) {
        assert.ok(paid.includes(id), `${c.id}: ${id} is not a paid question of the category`);
        assert.ok(!free.has(id), `${c.id}: free question ${id} is in a tranche`);
        assert.ok(!seen.has(id), `${c.id}: ${id} is in two tranches`);
        seen.add(id);
      }
    }
    assert.deepEqual(unassignedPaidQuestions(c), [], `${c.id}: paid questions in no tranche (assign them in constants/trancheAssignments.ts)`);
    assert.equal(seen.size, paid.length, c.id);
  }
  assert.deepEqual(Object.keys(TRANCHE_ASSIGNMENTS).sort(), young.map((c) => c.id).sort());
});

test('frozen boundaries are pinned by id: an owned tranche cannot silently change what it opens', () => {
  const ends = (id: string) => trancheRanges(cat(id)).map((r) => [r.ids[0], r.ids[r.ids.length - 1]]);
  assert.deepEqual(ends('giggle-factory'), [['kf-29', 'kf-89'], ['kf-90', 'kf-120']]);
  assert.deepEqual(ends('make-believe'), [['kf-4', 'kf-72'], ['kf-75', 'kf-223']]);
  assert.deepEqual(ends('dinner-table'), [['kf-69', 'kf-167'], ['kf-168', 'kf-193']]);
  assert.deepEqual(ends('holiday-table'), [['kf-121', 'kf-153']]);
  assert.deepEqual(ends('real-talk'), [['tn-5', 'tn-30']]);
});

test('growth: a new paid question is closed (not free, not in an owned tranche) until it is assigned; owned tranches do not shrink', () => {
  const holiday = cat('holiday-table');
  const before = trancheRanges(holiday).map((r) => r.size);
  const extra = { id: 'kf-9999', category: 'holiday-table', volume: 2, optionA: 'a', optionB: 'b' } as any;
  QUESTIONS.push(extra);
  try {
    assert.deepEqual(trancheRanges(holiday).map((r) => r.size), before, 'adding a question must not re-cut an owned tranche');
    assert.deepEqual(unassignedPaidQuestions(holiday), ['kf-9999']);
    const idx = getCategoryQuestions(holiday.id).length - 1;
    assert.equal(trancheOf(holiday, idx), -1);
    const owns1: Access = { all: false, ownedTranches: new Set([1]) };
    assert.equal(isQuestionOpen(holiday, idx, owns1), false);
    assert.equal(isQuestionOpen(holiday, idx - 1, owns1), true); // the originally owned tranche still opens
    assert.equal(isQuestionOpen(holiday, idx, { all: true, ownedTranches: new Set() }), true); // a pack opens it
    assert.equal(isCategoryFullyOpen(holiday, owns1), false);
  } finally {
    QUESTIONS.pop();
  }
  assert.deepEqual(unassignedPaidQuestions(holiday), []);
});

test('the free count is never a hardcoded 8: adult categories use 3 or 20, kids and teen 8', () => {
  const frees = new Set(adult.map((c) => getFreeQuestionCount(c)));
  assert.ok([...frees].every((n) => n === 3 || n === 20), [...frees].join());
  for (const c of young) assert.equal(getFreeQuestionCount(c), 8, c.id);
  for (const c of adult) {
    const qs = getCategoryQuestions(c.id);
    const free = getFreeQuestionCount(c);
    for (let i = 0; i < qs.length; i++) assert.equal(trancheOf(c, i) === 0, i < free, `${c.id} ${i}`);
  }
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
      assert.equal(isQuestionOpen(c, i, accessFor([], c)), !isQuestionLocked(c, i, false), `${c.id} ${i} locked`);
      assert.equal(isQuestionOpen(c, i, accessFor([entitlementForCategory(c.id)], c)), !isQuestionLocked(c, i, true), `${c.id} ${i} cat`);
      assert.equal(isQuestionOpen(c, i, accessFor([ENTITLEMENT_ALL], c)), !isQuestionLocked(c, i, true), `${c.id} ${i} pack`);
    }
  }
});

test('the one all-categories pack (Tim, 2026-11-24) opens every kids and teen category fully; an adult cat_<id> never opens one', () => {
  for (const c of young) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(accessFor([ENTITLEMENT_ALL], c).all, true, c.id);
    assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], c.id), true, c.id);
    assert.equal(openQuestionCount(c, accessFor([ENTITLEMENT_ALL], c)), n, c.id);
    assert.equal(accessFor([entitlementForCategory(c.id)], c).all, false, c.id);
    assert.equal(isCategoryEntitled([entitlementForCategory(c.id)], c.id), false, c.id);
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
