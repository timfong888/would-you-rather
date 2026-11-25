import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as questions from '../../constants/questions';
import {
  CATEGORIES,
  getAccessibleQuestions,
  getCategoryQuestions,
  getTranches,
  isQuestionLocked,
  trancheSize,
} from '../../constants/questions';
import { ENTITLEMENT_ALL } from '../../lib/catalog';
import { openTranchesFor, type AccessState } from '../../lib/access';

const base: AccessState = { ownerAccess: false, entitlements: new Set(), testUnlocks: new Set(), testUnlockEnabled: false };
const paidCats = CATEGORIES.filter((c) => getTranches(c).length > 0);

test('D22 (#255): after the 5 free questions a category has exactly one paid part, to the last question', () => {
  assert.ok(paidCats.length >= 16);
  for (const c of paidCats) {
    const n = getCategoryQuestions(c.id).length;
    assert.deepEqual(getTranches(c), [{ k: 1, first: 6, last: n }], c.id);
    assert.equal(trancheSize(getTranches(c)[0]), n - 5, c.id);
  }
  // 40-question and 45-question categories no longer split at 20.
  assert.deepEqual(getTranches(CATEGORIES.find((c) => c.id === 'tech-dystopia')!), [{ k: 1, first: 6, last: 40 }]);
  assert.deepEqual(getTranches(CATEGORIES.find((c) => c.id === 'giggle-factory')!).length, 1);
});

test('the tranche cut rule is gone', () => {
  assert.equal('trancheBounds' in questions, false);
  assert.equal('MAX_FOLDED_TAIL' in questions, false);
  assert.equal('SELLABLE_TRANCHE_MAX' in questions, false);
});

test('buying a category (cat_<id>) opens every remaining question in it, grown-up and kids alike', () => {
  for (const c of paidCats) {
    const state = { ...base, entitlements: new Set([`cat_${c.id}`]) };
    const access = openTranchesFor(state, c);
    getCategoryQuestions(c.id).forEach((_, i) => assert.equal(isQuestionLocked(c, i, access), false, `${c.id} ${i}`));
    assert.equal(getAccessibleQuestions(c, access).length, getCategoryQuestions(c.id).length, c.id);
  }
});

test('with nothing bought only the first 5 play; another category\'s purchase opens nothing here', () => {
  const td = CATEGORIES.find((c) => c.id === 'tech-dystopia')!;
  assert.equal(getAccessibleQuestions(td, openTranchesFor(base, td)).length, 5);
  assert.equal(getAccessibleQuestions(td, openTranchesFor({ ...base, entitlements: new Set(['cat_high-life']) }, td)).length, 5);
  // the old per-part entitlement ids are not products any more
  assert.equal(getAccessibleQuestions(td, openTranchesFor({ ...base, entitlements: new Set(['cat_tech-dystopia_2']) }, td)).length, 5);
});

test('premium_all still opens grown-up categories only; owner access and the test unlock still open everything', () => {
  for (const c of paidCats) {
    const adult = c.audience === 'adult';
    const all = getAccessibleQuestions(c, openTranchesFor({ ...base, entitlements: new Set([ENTITLEMENT_ALL]) }, c)).length;
    assert.equal(all, adult ? getCategoryQuestions(c.id).length : 5, c.id);
    assert.equal(openTranchesFor({ ...base, ownerAccess: true }, c), true, c.id);
    // the web free unlock stores the bare category id: it opens the whole category now
    const web = openTranchesFor({ ...base, testUnlockEnabled: true, testUnlocks: new Set([c.id]) }, c);
    assert.equal(getAccessibleQuestions(c, web).length, getCategoryQuestions(c.id).length, c.id);
  }
});

test('the gates stay off: kids and teen sell nothing yet', () => {
  assert.equal(questions.SELLABLE_YOUNG_TRANCHES, false);
  const kid = CATEGORIES.find((c) => c.audience === 'kids')!;
  assert.equal(questions.isTrancheSellable(kid), false);
  const adult = CATEGORIES.find((c) => c.id === 'tech-dystopia')!;
  assert.equal(questions.isTrancheSellable(adult), true);
});

test('the paywall sells the category product, with no tranche product id', () => {
  const src = readFileSync('app/unlock/[id].tsx', 'utf8');
  assert.doesNotMatch(src, /productForTranche/);
  assert.match(src, /productForCategory\(/);
});

test('the RevenueCat sync has no tranche logic', () => {
  const src = readFileSync('scripts/revenuecat/sync-catalog.ts', 'utf8');
  assert.doesNotMatch(src, /ranche/);
});
