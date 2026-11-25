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
  getTranches,
  isQuestionLocked,
  isQuestionPublic,
  trancheSize,
} from '../../constants/questions';
import { ENTITLEMENT_ALL } from '../../lib/catalog';
import { openTranchesFor } from '../../lib/access';
import type { AccessState } from '../../lib/access';

const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const FORTY = ['moral-compass', 'social-blunders', 'career-climber', 'tech-dystopia'];
const base: AccessState = { ownerAccess: false, entitlements: new Set(), testUnlocks: new Set(), testUnlockEnabled: false };

test('the plan table: nine grown-up categories, 5 free, one paid part from question 6 to the end (D22, #255)', () => {
  assert.equal(adult.length, 9);
  assert.equal(FREE_QUESTION_COUNT, 5);
  for (const c of adult) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(getFreeQuestionCount(c), 5, c.id);
    assert.equal(getLockedQuestionCount(c), n - 5, c.id);
    assert.deepEqual(getTranches(c), [{ k: 1, first: 6, last: n }], c.id);
    assert.equal(n, FORTY.includes(c.id) ? 40 : 20, c.id);
  }
});

test('free and the paid part cover every position once: no gap, no overlap, ending at n', () => {
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    let next = 1;
    for (const [from, to] of [[1, getFreeQuestionCount(c)], ...getTranches(c).map((t) => [t.first, t.last])]) {
      assert.equal(from, next, `${c.id} gap or overlap at ${from}`);
      next = to + 1;
    }
    assert.equal(next - 1, n, c.id);
  }
});

test('with nothing owned, exactly the first 5 are playable in every grown-up category', () => {
  for (const c of adult) {
    assert.equal(getAccessibleQuestions(c, false).length, 5, c.id);
    assert.equal(getAccessibleQuestions(c, new Set<number>()).length, 5, c.id);
    getCategoryQuestions(c.id).forEach((_, i) => assert.equal(isQuestionLocked(c, i, false), i >= 5, `${c.id} ${i}`));
  }
});

test('openTranchesFor: cat_<id> opens the whole category; another category\'s entitlement opens nothing here', () => {
  const td = adult.find((c) => c.id === 'tech-dystopia')!;
  assert.deepEqual([...(openTranchesFor(base, td) as Set<number>)], []);
  const bought = openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia']) }, td);
  assert.equal(getAccessibleQuestions(td, bought).length, 40);
  assert.equal(isQuestionLocked(td, 39, bought), false);
  assert.deepEqual([...(openTranchesFor({ ...base, entitlements: new Set(['cat_high-life']) }, td) as Set<number>)], []);
});

test('premium_all, owner access and the all-pack test unlock open every grown-up category; the bare id of the web unlock opens the category', () => {
  for (const c of adult) {
    assert.equal(openTranchesFor({ ...base, entitlements: new Set([ENTITLEMENT_ALL]) }, c), true, c.id);
    assert.equal(openTranchesFor({ ...base, ownerAccess: true }, c), true, c.id);
    assert.equal(openTranchesFor({ ...base, testUnlocks: new Set([ENTITLEMENT_ALL]), testUnlockEnabled: true }, c), true, c.id);
    const web = openTranchesFor({ ...base, testUnlocks: new Set([c.id]), testUnlockEnabled: true }, c);
    assert.equal(getAccessibleQuestions(c, web).length, getCategoryQuestions(c.id).length, c.id);
    assert.deepEqual([...(openTranchesFor({ ...base, testUnlocks: new Set([c.id]), testUnlockEnabled: false }, c) as Set<number>)], [], c.id);
  }
});

test('kids and teen: 5 free, one paid part each, premium_all never opens them', () => {
  const young = CATEGORIES.filter((c) => c.audience !== 'adult');
  assert.equal(young.length, 9);
  for (const c of young) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(getFreeQuestionCount(c), 5, c.id);
    assert.deepEqual(getTranches(c), [{ k: 1, first: 6, last: n }], c.id);
    assert.equal(trancheSize(getTranches(c)[0]), n - 5, c.id);
    const setOf = (a: unknown) => a as ReadonlySet<number>;
    assert.equal(setOf(openTranchesFor(base, c)).size, 0, c.id);
    assert.equal(getAccessibleQuestions(c, openTranchesFor({ ...base, entitlements: new Set([`cat_${c.id}`]) }, c)).length, n, c.id);
    assert.equal(setOf(openTranchesFor({ ...base, entitlements: new Set(['premium_all']) }, c)).size, 0, `premium_all: ${c.id}`);
    assert.equal(setOf(openTranchesFor({ ...base, testUnlockEnabled: true, testUnlocks: new Set(['premium_all']) }, c)).size, 0, `test all: ${c.id}`);
    assert.equal(openTranchesFor({ ...base, ownerAccess: true }, c), true, `owner: ${c.id}`);
    assert.equal(getAccessibleQuestions(c, false).length, 5, c.id);
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
