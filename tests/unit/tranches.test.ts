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

test('kids and teen: ONE step of 20 per category after the 5 free ones; the rest are withheld, kept, not sold (Tim, 2026-11-24: "max it 20 per kid")', () => {
  for (const c of young) assert.deepEqual(trancheRanges(c).map((r) => r.size), [20], c.id);
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).length, 0), 9);
  assert.equal(young.reduce((n, c) => n + TRANCHE_ASSIGNMENTS[c.id].withheld.length, 0), 101); // 281 paid - 180 sold
  assert.equal(TRANCHE_SIZE, 20);
});

test('kids and teen: step 1 is positions 6 to 25 and withheld is positions 26 onward, in list order', () => {
  for (const c of young) {
    const list = getCategoryQuestions(c.id).map((q) => q.id);
    const a = TRANCHE_ASSIGNMENTS[c.id];
    assert.deepEqual(a.tranches.flat(), list.slice(getFreeQuestionCount(c), getFreeQuestionCount(c) + 20), `${c.id} step`);
    assert.deepEqual(a.withheld, list.slice(getFreeQuestionCount(c) + 20), `${c.id} withheld`);
  }
});

test('frozen membership: every paid kids and teen question is in exactly one list (step or withheld), nothing free or unknown is, and no id is duplicated', () => {
  for (const c of young) {
    const qs = getCategoryQuestions(c.id);
    const free = new Set(qs.slice(0, getFreeQuestionCount(c)).map((q) => q.id));
    const paid = qs.slice(getFreeQuestionCount(c)).map((q) => q.id);
    const a = TRANCHE_ASSIGNMENTS[c.id];
    const seen = new Set<string>();
    for (const id of [...a.tranches.flat(), ...a.withheld]) {
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

test('withheld questions are closed for the pack and for every step, so nothing past the cap is playable or for sale; the category counts as fully open without them', () => {
  for (const c of young) {
    const n = getCategoryQuestions(c.id).length;
    const full = accessFor([ENTITLEMENT_ALL, entitlementForTranche(c.id, 1)], c);
    assert.equal(openQuestionCount(c, full, LIMITED), 25, c.id);
    assert.equal(openQuestionCount(c, full, LIMITED) < n, true, c.id);
    assert.equal(isCategoryFullyOpen(c, full, LIMITED), true, c.id);
    assert.equal(nextTrancheToSell(c, full, LIMITED), null, c.id);
    assert.equal(isCategoryFullyOpen(c, accessFor([], c), LIMITED), false, c.id);
  }
});

test('frozen boundaries are pinned by id: an owned step cannot silently change what it opens', () => {
  const t = (id: string) => TRANCHE_ASSIGNMENTS[id].tranches.map((l) => [l[0], l[l.length - 1]]);
  assert.deepEqual(t('giggle-factory'), [['kf-101', 'kf-86']]);
  assert.deepEqual(t('make-believe'), [['kf-13', 'kf-23']]);
  assert.deepEqual(t('dinner-table'), [['kf-192', 'kf-163']]);
  assert.deepEqual(t('holiday-table'), [['kf-150', 'kf-144']]);
  assert.deepEqual(t('real-talk'), [['tn-8', 'tn-24']]);
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
    assert.equal(isQuestionOpen(holiday, 5, owns1, LIMITED), true); // the originally owned step still opens
    assert.equal(isQuestionOpen(holiday, idx, { all: true, pack: false, ownedTranches: new Set() }, LIMITED), true); // owner access opens it
    assert.equal(isCategoryFullyOpen(holiday, owns1, LIMITED), false); // a new paid question nobody assigned is for sale to nobody, so not 'fully open'
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

test('TARGET (4c): the step opens only its own 20 questions; step without the pack, and pack without the step, each open the same 25 in a kids category', () => {
  const g = cat('giggle-factory'); // 55 questions: 5 free, step 1 = positions 6 to 25, 30 withheld
  const n = getCategoryQuestions(g.id).length;
  for (const ents of [[entitlementForTranche('giggle-factory', 1)], [ENTITLEMENT_ALL], [ENTITLEMENT_ALL, entitlementForTranche('giggle-factory', 1)]]) {
    const a = accessFor(ents, g);
    for (let i = 0; i < n; i++) assert.equal(isQuestionOpen(g, i, a, LIMITED), i < 25, `${ents.join()} question ${i}`);
  }
  for (let i = 0; i < n; i++) assert.equal(isQuestionOpen(g, i, accessFor([], g), LIMITED), i < 5, `none ${i}`);
});

test('questionZone and the paywall at the boundaries (Giggle Factory: 5 free, step 1 = positions 6 to 25, then withheld)', () => {
  const g = cat('giggle-factory');
  assert.deepEqual(questionZone(g, 4), { free: true, pack: false, tranche: 0 });
  assert.deepEqual(questionZone(g, 5), { free: false, pack: true, tranche: 1 });
  assert.deepEqual(questionZone(g, 24), { free: false, pack: true, tranche: 1 });
  assert.deepEqual(questionZone(g, 25), { free: false, pack: false, tranche: 0 }); // withheld
  assert.deepEqual(questionZone(g, 54), { free: false, pack: false, tranche: 0 });
  assert.equal(nextTrancheToSell(g, noAccess(), LIMITED)?.k, 1);
  assert.equal(nextTrancheToSell(g, { all: false, pack: true, ownedTranches: new Set() }, LIMITED), null); // the pack opens step 1
  assert.equal(nextTrancheToSell(g, { all: false, pack: false, ownedTranches: new Set([1]) }, LIMITED), null);
  assert.equal(isCategoryFullyOpen(g, { all: false, pack: false, ownedTranches: new Set([1]) }, LIMITED), true);
});

test('adult paywall (target): a premium-tier adult category the pack opens fully has nothing left to sell', () => {
  const h = cat('high-life'); // 20 questions: 5 free + 15 paid, all inside the pack\'s step 1
  assert.equal(nextTrancheToSell(h, accessFor([ENTITLEMENT_ALL], h), LIMITED), null);
  assert.equal(nextTrancheToSell(h, noAccess(), LIMITED)?.k, 1);
  const m = cat('moral-compass'); // 40 questions: pack opens 25, the other 15 stay behind cat_<id>
  assert.equal(nextTrancheToSell(m, accessFor([ENTITLEMENT_ALL], m), LIMITED)?.k, 1);
});

test('refund example: the step refunded and no pack closes exactly the step; the pack alone still opens it', () => {
  const g = cat('giggle-factory');
  const refunded = accessFor([], g);
  assert.equal(openQuestionCount(g, refunded, LIMITED), 5);
  assert.equal(nextTrancheToSell(g, refunded, LIMITED)?.k, 1);
  assert.equal(openQuestionCount(g, accessFor([ENTITLEMENT_ALL], g), LIMITED), 25);
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
