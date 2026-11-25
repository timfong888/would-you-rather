import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  FREE_QUESTION_COUNT,
  getAccessibleQuestions,
  getCategoryQuestions,
  getFreeQuestionCount,
  getLockedQuestionCount,
  getPublicQuestions,
  getQuestionVolume,
  getTranches,
  isQuestionLocked,
  isQuestionPublic,
  trancheBounds,
  type CategoryId,
} from '../../constants/questions';
import { ENTITLEMENT_ALL } from '../../lib/catalog';
import { openTranchesFor } from '../../lib/access';
import type { AccessState } from '../../lib/access';

const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const FORTY: CategoryId[] = ['moral-compass', 'social-blunders', 'career-climber', 'tech-dystopia'];
const base: AccessState = { ownerAccess: false, entitlements: new Set(), testUnlocks: new Set(), testUnlockEnabled: false };
const cat = (id: CategoryId) => adult.find((c) => c.id === id)!;

test('the plan table: nine grown-up categories, 5 free, tranche 1 = 6-20, tranche 2 = 21-40 in four', () => {
  assert.equal(adult.length, 9);
  assert.equal(FREE_QUESTION_COUNT, 5);
  for (const c of adult) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(getFreeQuestionCount(c), 5, c.id);
    assert.equal(getLockedQuestionCount(c), n - 5, c.id);
    const t = getTranches(c);
    if (FORTY.includes(c.id)) {
      assert.equal(n, 40, c.id);
      assert.deepEqual(t, [{ k: 1, first: 6, last: 20 }, { k: 2, first: 21, last: 40 }], c.id);
    } else {
      assert.equal(n, 20, c.id);
      assert.deepEqual(t, [{ k: 1, first: 6, last: 20 }], c.id);
    }
  }
});

test('free and tranches cover every position once: no gap, no overlap, last tranche ends at n', () => {
  for (const c of adult) {
    const n = getCategoryQuestions(c.id).length;
    let next = 1;
    for (const [from, to] of [[1, getFreeQuestionCount(c)], ...getTranches(c).map((t) => [t.first, t.last])]) {
      assert.equal(from, next, `${c.id} gap or overlap at ${from}`);
      next = to + 1;
    }
    assert.equal(next - 1, n, c.id);
  }
});

test('tranche 2 of each 40-question category is exactly its volume 2 questions', () => {
  for (const id of FORTY) {
    const c = cat(id);
    const t2 = getTranches(c)[1];
    const qs = getCategoryQuestions(id).slice(t2.first - 1, t2.last);
    assert.ok(qs.every((q) => getQuestionVolume(q) === 2), id);
    assert.equal(qs.length, getCategoryQuestions(id).filter((q) => getQuestionVolume(q) === 2).length, id);
  }
});

test('trancheBounds: cut points at 20, 40, 60; a remainder under 10 joins the previous tranche', () => {
  assert.deepEqual(trancheBounds(20, 5), [{ k: 1, first: 6, last: 20 }]);
  assert.deepEqual(trancheBounds(40, 5), [{ k: 1, first: 6, last: 20 }, { k: 2, first: 21, last: 40 }]);
  assert.deepEqual(trancheBounds(45, 5), [{ k: 1, first: 6, last: 20 }, { k: 2, first: 21, last: 45 }]);
  assert.deepEqual(trancheBounds(50, 5), [{ k: 1, first: 6, last: 20 }, { k: 2, first: 21, last: 40 }, { k: 3, first: 41, last: 50 }]);
  assert.deepEqual(trancheBounds(3, 5), []);
  assert.deepEqual(trancheBounds(5, 5), []);
  assert.deepEqual(trancheBounds(6, 5), [{ k: 1, first: 6, last: 6 }]);
});

test('with nothing owned, exactly the first 5 are playable in every grown-up category', () => {
  for (const c of adult) {
    assert.equal(getAccessibleQuestions(c, false).length, 5, c.id);
    assert.equal(getAccessibleQuestions(c, new Set<number>()).length, 5, c.id);
    getCategoryQuestions(c.id).forEach((_, i) => assert.equal(isQuestionLocked(c, i, false), i >= 5, `${c.id} ${i}`));
  }
});

test('access is by the set of owned tranches, never a prefix', () => {
  const td = cat('tech-dystopia');
  const lockedIdx = (owned: number[]) =>
    getCategoryQuestions('tech-dystopia').map((_, i) => i).filter((i) => isQuestionLocked(td, i, new Set(owned)));
  assert.equal(lockedIdx([1]).join(), Array.from({ length: 20 }, (_, i) => i + 20).join(), 'tranche 1 opens 6-20 only');
  assert.equal(lockedIdx([1, 2]).length, 0);
  assert.equal(lockedIdx([2]).join(), Array.from({ length: 15 }, (_, i) => i + 5).join(), 'tranche 2 alone opens 21-40 only');
  assert.equal(isQuestionLocked(td, 0, new Set()), false);
  assert.equal(isQuestionLocked(td, 25, true), false);
});

test('openTranchesFor: entitlements map to tranches; tranche 1 keeps the existing cat_<id>', () => {
  const td = cat('tech-dystopia');
  assert.deepEqual([...(openTranchesFor(base, td) as Set<number>)], []);
  assert.deepEqual([...(openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia']) }, td) as Set<number>)], [1]);
  assert.deepEqual([...(openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia_2']) }, td) as Set<number>)], [2]);
  assert.deepEqual([...(openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia', 'cat_tech-dystopia_2']) }, td) as Set<number>)].sort(), [1, 2]);
  // refund of tranche 1 while tranche 2 is owned closes exactly 6-20
  const afterRefund = openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia_2']) }, td);
  assert.equal(isQuestionLocked(td, 10, afterRefund), true);
  assert.equal(isQuestionLocked(td, 30, afterRefund), false);
  // another category's entitlement opens nothing here
  assert.deepEqual([...(openTranchesFor({ ...base, entitlements: new Set(['cat_high-life']) }, td) as Set<number>)], []);
});

test('premium_all, owner access and test unlocks open every tranche of every grown-up category', () => {
  for (const c of adult) {
    assert.equal(openTranchesFor({ ...base, entitlements: new Set([ENTITLEMENT_ALL]) }, c), true, c.id);
    assert.equal(openTranchesFor({ ...base, ownerAccess: true }, c), true, c.id);
    assert.equal(openTranchesFor({ ...base, testUnlocks: new Set([c.id]), testUnlockEnabled: true }, c), true, c.id);
    assert.deepEqual([...(openTranchesFor({ ...base, testUnlocks: new Set([c.id]), testUnlockEnabled: false }, c) as Set<number>)], [], c.id);
  }
});

test('kids and teen keep their rule: 8 free, one paid tranche, all-or-nothing access', () => {
  for (const c of CATEGORIES.filter((c) => c.audience !== 'adult')) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(getFreeQuestionCount(c), 8, c.id);
    assert.deepEqual(getTranches(c), [{ k: 1, first: 9, last: n }], c.id);
    assert.equal(openTranchesFor(base, c), false, c.id);
    assert.equal(openTranchesFor({ ...base, entitlements: new Set([`cat_${c.id}`]) }, c), true, c.id);
    assert.equal(getAccessibleQuestions(c, false).length, 8, c.id);
  }
});

test('the public (SEO) set stays at the rule before #238 until step F3', () => {
  for (const c of adult) {
    const expected = FORTY.includes(c.id) ? 20 : 3;
    assert.equal(getPublicQuestions(c).length, expected, c.id);
    assert.equal(isQuestionPublic(c, expected - 1), true, c.id);
    assert.equal(isQuestionPublic(c, expected), false, c.id);
  }
});
