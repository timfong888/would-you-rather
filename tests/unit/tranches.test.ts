// Unit 4a of #124 (docs/specs/kids-family-categories.md §3.4, docs/specs/plan.md): the pure access model.
// Tim, 2026-11-24: N = 5 free questions in every category; each $1.99 opens the next 20 in ONE category; the pack opens step 1 of every category.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  QUESTIONS,
  getCategoryById,
  getCategoryQuestions,
  FREE_QUESTIONS_PER_CATEGORY,
  getFreeQuestionCount,
  isQuestionLocked,
} from '../../constants/questions';
import { TRANCHE_ASSIGNMENTS } from '../../constants/trancheAssignments';
import {
  PACK_LIMITED_TO_FIRST_STEP,
  TRANCHE_SIZE,
  isCategoryFullyOpen,
  isQuestionOpen,
  nextTrancheToSell,
  noAccess,
  openQuestionCount,
  questionZone,
  trancheRanges,
  trancheSizes,
  unassignedPaidQuestions,
} from '../../lib/tranches';
import type { Access } from '../../lib/tranches';
import { ENTITLEMENT_ALL, accessFor, entitlementForCategory, entitlementForTranche, isCategoryEntitled } from '../../lib/catalog';

const young = CATEGORIES.filter((c) => c.audience !== 'adult');
const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const cat = (id: string) => getCategoryById(id as any)!;
const LIMITED = true; // the target behavior (4c): the pack opens only step 1 of every category
const UNLIMITED = false; // today's behavior (4a staging)

test('remainder rule (used to define NEW tranches): under 10 joins the previous tranche, otherwise its own', () => {
  assert.deepEqual(trancheSizes(10), [10]);
  assert.deepEqual(trancheSizes(13), [13]);
  assert.deepEqual(trancheSizes(21), [21]);
  assert.deepEqual(trancheSizes(27), [27]);
  assert.deepEqual(trancheSizes(35), [20, 15]);
  assert.deepEqual(trancheSizes(20), [20]);
  assert.deepEqual(trancheSizes(40), [20, 20]);
  assert.deepEqual(trancheSizes(30), [20, 10]); // exactly 10 is its own tranche
  assert.deepEqual(trancheSizes(7), [7]); // nothing before it to join
  assert.deepEqual(trancheSizes(0), []);
});

test('kids and teen: 281 paid questions in 13 steps after the 5 free ones (Tim, 2026-11-24)', () => {
  const sizes = Object.fromEntries(young.map((c) => [c.id, trancheRanges(c).map((r) => r.size)]));
  assert.deepEqual(sizes, {
    'tiny-choices': [25],
    'make-believe': [20, 16],
    'giggle-factory': [20, 20, 10],
    'road-trip-rally': [25],
    'dinner-table': [20, 22],
    'heart-to-heart': [25],
    'future-me': [25],
    'real-talk': [25],
    'holiday-table': [28],
  });
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).length, 0), 13);
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).reduce((m, r) => m + r.size, 0), 0), 281);
  for (const c of young) assert.equal(getCategoryQuestions(c.id).length - FREE_QUESTIONS_PER_CATEGORY, trancheRanges(c).reduce((m, r) => m + r.size, 0), c.id);
  assert.equal(TRANCHE_SIZE, 20);
});

test('kids and teen: the steps are the questions after the free ones, in list order', () => {
  for (const c of young) {
    const list = getCategoryQuestions(c.id).map((q) => q.id);
    assert.deepEqual(TRANCHE_ASSIGNMENTS[c.id].tranches.flat(), list.slice(getFreeQuestionCount(c)), `${c.id} steps`);
  }
});

test('frozen membership: every paid kids and teen question is in exactly one step, nothing free or unknown is, and no id is duplicated', () => {
  for (const c of young) {
    const qs = getCategoryQuestions(c.id);
    const free = new Set(qs.slice(0, getFreeQuestionCount(c)).map((q) => q.id));
    const paid = qs.slice(getFreeQuestionCount(c)).map((q) => q.id);
    const seen = new Set<string>();
    for (const id of TRANCHE_ASSIGNMENTS[c.id].tranches.flat()) {
      assert.ok(paid.includes(id), `${c.id}: ${id} is not a paid question of the category`);
      assert.ok(!free.has(id), `${c.id}: free question ${id} is in a list`);
      assert.ok(!seen.has(id), `${c.id}: ${id} is in two lists`);
      seen.add(id);
    }
    assert.deepEqual(unassignedPaidQuestions(c), [], `${c.id}: paid questions in no list (assign them in constants/trancheAssignments.ts)`);
    assert.equal(seen.size, paid.length, c.id);
  }
  assert.deepEqual(Object.keys(TRANCHE_ASSIGNMENTS).sort(), young.map((c) => c.id).sort());
});

test('frozen boundaries are pinned by id: an owned step cannot silently change what it opens', () => {
  const t = (id: string) => TRANCHE_ASSIGNMENTS[id].tranches.map((l) => [l[0], l[l.length - 1]]);
  assert.deepEqual(t('giggle-factory'), [['kf-101', 'kf-86'], ['kf-87', 'kf-109'], ['kf-110', 'kf-120']]);
  assert.deepEqual(t('make-believe'), [['kf-13', 'kf-23'], ['kf-25', 'kf-223']]);
  assert.deepEqual(t('dinner-table'), [['kf-192', 'kf-163'], ['kf-165', 'kf-193']]);
  assert.deepEqual(t('holiday-table'), [['kf-150', 'kf-153']]);
  assert.deepEqual(t('real-talk'), [['tn-8', 'tn-30']]);
});

test('growth: a new paid question is closed (even with the pack limited) until it is assigned; owned tranches do not shrink', () => {
  const holiday = cat('holiday-table');
  const before = trancheRanges(holiday).map((r) => r.size);
  const extra = { id: 'kf-9999', category: 'holiday-table', volume: 2, optionA: 'a', optionB: 'b' } as any;
  QUESTIONS.push(extra);
  try {
    assert.deepEqual(trancheRanges(holiday).map((r) => r.size), before, 'adding a question must not re-cut an owned tranche');
    assert.deepEqual(unassignedPaidQuestions(holiday), ['kf-9999']);
    const idx = getCategoryQuestions(holiday.id).length - 1;
    const owns1: Access = { all: false, pack: true, ownedTranches: new Set([1]) };
    assert.equal(isQuestionOpen(holiday, idx, owns1, LIMITED), false);
    assert.equal(isQuestionOpen(holiday, idx - 1, owns1, LIMITED), true); // the originally owned tranche still opens
    assert.equal(isQuestionOpen(holiday, idx, { all: true, pack: false, ownedTranches: new Set() }, LIMITED), true); // owner access opens it
    assert.equal(isCategoryFullyOpen(holiday, owns1, LIMITED), false);
  } finally {
    QUESTIONS.pop();
  }
  assert.deepEqual(unassignedPaidQuestions(holiday), []);
});

test('the free count is one constant: N = 5 in every category, adult, kids and teen (Tim, 2026-11-24)', () => {
  assert.equal(FREE_QUESTIONS_PER_CATEGORY, 5);
  for (const c of CATEGORIES) assert.equal(getFreeQuestionCount(c), FREE_QUESTIONS_PER_CATEGORY, c.id);
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    for (let i = 0; i < n; i++) assert.equal(questionZone(c, i).free, i < getFreeQuestionCount(c), `${c.id} ${i}`);
  }
});

test('STAGING (4a): the pack is not limited yet, so it keeps opening everything it opens today in every category', () => {
  assert.equal(PACK_LIMITED_TO_FIRST_STEP, false); // 4c flips this with the paywall change
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    assert.equal(openQuestionCount(c, accessFor([ENTITLEMENT_ALL], c)), n, c.id);
    assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], c.id), true, c.id);
  }
});

test('adult regression (today\'s behavior): every adult question is open or locked exactly as the old boolean rule says', () => {
  for (const c of adult) {
    const n = getCategoryQuestions(c.id).length;
    for (let i = 0; i < n; i++) {
      assert.equal(isQuestionOpen(c, i, accessFor([], c), UNLIMITED), !isQuestionLocked(c, i, false), `${c.id} ${i} locked`);
      assert.equal(isQuestionOpen(c, i, accessFor([entitlementForCategory(c.id)], c), UNLIMITED), !isQuestionLocked(c, i, true), `${c.id} ${i} cat`);
      assert.equal(isQuestionOpen(c, i, accessFor([ENTITLEMENT_ALL], c), UNLIMITED), !isQuestionLocked(c, i, true), `${c.id} ${i} pack`);
    }
  }
});

test('an adult category is one tranche, granted by the existing cat_<id> entitlement (never cat_<id>_1)', () => {
  for (const c of adult) {
    assert.ok(trancheRanges(c).length <= 1, `${c.id} is not split`);
    const n = getCategoryQuestions(c.id).length;
    assert.equal(openQuestionCount(c, accessFor([entitlementForCategory(c.id)], c)), n, c.id);
    assert.equal(openQuestionCount(c, accessFor([`${entitlementForCategory(c.id)}_1`], c), UNLIMITED), getFreeQuestionCount(c), `${c.id}: cat_<id>_1 must not grant an adult category`);
  }
});

test('TARGET (4c, pack limited): the pack opens the free questions plus step 1 of every category, adult and kids and teen; no more', () => {
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    const pack = accessFor([ENTITLEMENT_ALL], c);
    const step1 = c.audience === 'adult' ? TRANCHE_SIZE : trancheRanges(c)[0].size;
    const expectOpen = Math.min(n, FREE_QUESTIONS_PER_CATEGORY + step1);
    for (let i = 0; i < n; i++) assert.equal(isQuestionOpen(c, i, pack, LIMITED), i < expectOpen, `${c.id} ${i}`);
    assert.equal(openQuestionCount(c, pack, LIMITED), expectOpen, c.id);
  }
});

test('TARGET (4c): the per-category $1.99 opens the rest; adult cat_<id> is everything paid, so the 4 free-tier adult categories are fully open with it', () => {
  for (const c of adult) {
    assert.equal(openQuestionCount(c, accessFor([entitlementForCategory(c.id)], c), LIMITED), getCategoryQuestions(c.id).length, c.id);
  }
  // pack alone leaves what behind the $1.99: adult free-tier 15 each (40 - 5 free - 20), premium-tier none (20 - 5 = 15 < 20)
  const behind = (c: (typeof adult)[number]) => getCategoryQuestions(c.id).length - openQuestionCount(c, accessFor([ENTITLEMENT_ALL], c), LIMITED);
  assert.deepEqual(adult.map((c) => [c.id, behind(c)] as [string, number]).filter(([, n]) => n > 0).sort(), [['career-climber', 15], ['moral-compass', 15], ['social-blunders', 15], ['tech-dystopia', 15]]);
});

test('TARGET (4c): a step opens only its own questions; the pack plus step 2 opens free, step 1 and step 2', () => {
  const g = cat('giggle-factory'); // 55 questions: 5 free, steps of 20, 20, 10
  const list = getCategoryQuestions(g.id).map((q) => q.id);
  const packAnd2 = accessFor([ENTITLEMENT_ALL, entitlementForTranche('giggle-factory', 2)], g);
  list.forEach((_, i) => assert.equal(isQuestionOpen(g, i, packAnd2, LIMITED), i < 45, `question ${i}`));
  const only2 = accessFor([entitlementForTranche('giggle-factory', 2)], g); // no pack
  list.forEach((_, i) => assert.equal(isQuestionOpen(g, i, only2, LIMITED), i < 5 || (i >= 25 && i < 45), `question ${i}`));
});

test('questionZone and the paywall at the boundaries (Giggle Factory: 5 free, step 1 = positions 6 to 25, step 2 = 26 to 45, step 3 = 46 to 55)', () => {
  const g = cat('giggle-factory');
  assert.deepEqual(questionZone(g, 4), { free: true, pack: false, tranche: 0 });
  assert.deepEqual(questionZone(g, 5), { free: false, pack: true, tranche: 1 });
  assert.deepEqual(questionZone(g, 24), { free: false, pack: true, tranche: 1 });
  assert.deepEqual(questionZone(g, 25), { free: false, pack: false, tranche: 2 });
  assert.deepEqual(questionZone(g, 44), { free: false, pack: false, tranche: 2 });
  assert.deepEqual(questionZone(g, 45), { free: false, pack: false, tranche: 3 });
  assert.deepEqual(questionZone(g, 54), { free: false, pack: false, tranche: 3 });
  assert.equal(nextTrancheToSell(g, noAccess(), LIMITED)?.k, 1);
  const pack: Access = { all: false, pack: true, ownedTranches: new Set() };
  assert.equal(nextTrancheToSell(g, pack, LIMITED)?.k, 2); // the pack already opens step 1
  assert.equal(nextTrancheToSell(g, { all: false, pack: true, ownedTranches: new Set([2, 3]) }, LIMITED), null);
  assert.equal(isCategoryFullyOpen(g, { all: false, pack: true, ownedTranches: new Set([2, 3]) }, LIMITED), true);
  assert.equal(isCategoryFullyOpen(g, { all: false, pack: false, ownedTranches: new Set([1, 2, 3]) }, LIMITED), true);
});

test('adult paywall (target): a premium-tier adult category the pack opens fully has nothing left to sell', () => {
  const h = cat('high-life'); // 20 questions: 5 free + 15 paid, all inside the pack\'s step 1
  assert.equal(nextTrancheToSell(h, accessFor([ENTITLEMENT_ALL], h), LIMITED), null);
  assert.equal(nextTrancheToSell(h, noAccess(), LIMITED)?.k, 1);
  const m = cat('moral-compass'); // 40 questions: pack opens 25, the other 15 stay behind cat_<id>
  assert.equal(nextTrancheToSell(m, accessFor([ENTITLEMENT_ALL], m), LIMITED)?.k, 1);
});

test('refund example: step 1 refunded, step 2 still owned (no pack) opens the free questions and exactly step 2; the paywall offers step 1', () => {
  const g = cat('giggle-factory');
  const access = accessFor([entitlementForTranche('giggle-factory', 2)], g);
  assert.deepEqual([...access.ownedTranches], [2]);
  const n = getCategoryQuestions(g.id).length;
  const open = Array.from({ length: n }, (_, i) => isQuestionOpen(g, i, access, LIMITED));
  open.forEach((o, i) => assert.equal(o, i < 5 || (i >= 25 && i < 45), `question ${i}`));
  assert.equal(openQuestionCount(g, access, LIMITED), 5 + 20);
  assert.equal(nextTrancheToSell(g, access, LIMITED)?.k, 1);
  assert.equal(isCategoryFullyOpen(g, access, LIMITED), false);
});

test('4a staging: the legacy per-category unlock cat_<id>, still sold by the live kids paywall, keeps opening the whole kids or teen category (4c changes the paywall)', () => {
  for (const c of young) {
    const n = getCategoryQuestions(c.id).length;
    const access = accessFor([entitlementForCategory(c.id)], c);
    assert.equal(access.all, true, c.id);
    assert.equal(isCategoryEntitled([entitlementForCategory(c.id)], c.id), true, c.id);
    assert.equal(openQuestionCount(c, access), n, c.id);
    const other = young.find((o) => o.id !== c.id)!;
    assert.equal(isCategoryEntitled([entitlementForCategory(other.id)], c.id), false, c.id);
  }
});

test('an owned set of every step fully opens a category, with or without the pack', () => {
  const g = cat('giggle-factory');
  const steps = [1, 2, 3].map((k) => entitlementForTranche('giggle-factory', k));
  assert.equal(isCategoryFullyOpen(g, accessFor(steps, g), LIMITED), true);
  assert.equal(isCategoryFullyOpen(g, accessFor([ENTITLEMENT_ALL, ...steps.slice(1)], g), LIMITED), true);
  assert.equal(isCategoryFullyOpen(g, accessFor([ENTITLEMENT_ALL, steps[1]], g), LIMITED), false);
});

test('an id that is not a category is treated as adult: the pack covers a category added later', () => {
  assert.equal(isCategoryEntitled([ENTITLEMENT_ALL], 'a-category-added-later'), true);
  assert.equal(isCategoryEntitled([], 'a-category-added-later'), false);
});

test('old boolean helpers still exist and behave the same in 4a (callers move in 4b)', () => {
  const g = cat('giggle-factory');
  assert.equal(isQuestionLocked(g, 4, false), false);
  assert.equal(isQuestionLocked(g, 5, false), true);
  assert.equal(isQuestionLocked(g, 5, true), false);
});
