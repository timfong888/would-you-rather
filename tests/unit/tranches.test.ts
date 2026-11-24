// Unit 4a of #124 (docs/specs/kids-family-categories.md §3.4, docs/specs/plan.md): the pure access model.
// Tim, 2026-11-24: the pack opens the first 20 questions of every category; each $1.99 opens the next batch in ONE category.
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
  PACK_LIMITED_TO_FIRST_20,
  PACK_QUESTION_LIMIT,
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
const LIMITED = true; // the target behavior (4c): the pack opens only the first 20 questions per category
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

test('the pack opens the first 20 questions of every category; the kids and teen questions beyond 20 are 146 in 10 tranches (Tim, 2026-11-24)', () => {
  assert.equal(PACK_QUESTION_LIMIT, 20);
  const sizes = Object.fromEntries(young.map((c) => [c.id, trancheRanges(c).map((r) => r.size)]));
  assert.deepEqual(sizes, {
    'tiny-choices': [10],
    'make-believe': [21],
    'giggle-factory': [20, 15],
    'road-trip-rally': [10],
    'dinner-table': [27],
    'heart-to-heart': [10],
    'future-me': [10],
    'real-talk': [10],
    'holiday-table': [13],
  });
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).length, 0), 10);
  assert.equal(young.reduce((n, c) => n + trancheRanges(c).reduce((m, r) => m + r.size, 0), 0), 146);
  for (const c of young) assert.equal(getCategoryQuestions(c.id).length - 20, trancheRanges(c).reduce((m, r) => m + r.size, 0), c.id);
});

test('kids and teen: the pack list is positions 9 to 20 and the tranches are positions 21 onward, in list order', () => {
  for (const c of young) {
    const list = getCategoryQuestions(c.id).map((q) => q.id);
    const a = TRANCHE_ASSIGNMENTS[c.id];
    assert.deepEqual(a.pack, list.slice(getFreeQuestionCount(c), PACK_QUESTION_LIMIT), `${c.id} pack`);
    assert.deepEqual(a.tranches.flat(), list.slice(PACK_QUESTION_LIMIT), `${c.id} tranches`);
  }
});

test('frozen membership: every paid kids and teen question is in exactly one list, nothing free or unknown is, and no id is duplicated', () => {
  for (const c of young) {
    const qs = getCategoryQuestions(c.id);
    const free = new Set(qs.slice(0, getFreeQuestionCount(c)).map((q) => q.id));
    const paid = qs.slice(getFreeQuestionCount(c)).map((q) => q.id);
    const a = TRANCHE_ASSIGNMENTS[c.id];
    const seen = new Set<string>();
    for (const id of [...a.pack, ...a.tranches.flat()]) {
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

test('frozen boundaries are pinned by id: an owned tranche cannot silently change what it opens', () => {
  const t = (id: string) => TRANCHE_ASSIGNMENTS[id].tranches.map((l) => [l[0], l[l.length - 1]]);
  assert.deepEqual(t('giggle-factory'), [['kf-41', 'kf-104'], ['kf-105', 'kf-120']]);
  assert.deepEqual(t('make-believe'), [['kf-18', 'kf-223']]);
  assert.deepEqual(t('dinner-table'), [['kf-159', 'kf-193']]);
  assert.deepEqual(t('holiday-table'), [['kf-138', 'kf-153']]);
  assert.deepEqual(t('real-talk'), [['tn-20', 'tn-30']]);
  assert.deepEqual([TRANCHE_ASSIGNMENTS['giggle-factory'].pack[0], TRANCHE_ASSIGNMENTS['giggle-factory'].pack[11]], ['kf-29', 'kf-40']);
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

test('the free count is never a hardcoded 8: adult 3 or 20, kids and teen 8', () => {
  const frees = new Set(adult.map((c) => getFreeQuestionCount(c)));
  assert.ok([...frees].every((n) => n === 3 || n === 20), [...frees].join());
  for (const c of young) assert.equal(getFreeQuestionCount(c), 8, c.id);
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    for (let i = 0; i < n; i++) assert.equal(questionZone(c, i).free, i < getFreeQuestionCount(c), `${c.id} ${i}`);
  }
});

test('STAGING (4a): the pack is not limited yet, so it keeps opening everything it opens today in every category', () => {
  assert.equal(PACK_LIMITED_TO_FIRST_20, false); // 4c flips this with the paywall change
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

test('TARGET (4c, pack limited): the pack opens exactly the first 20 questions of every category, adult included; Moral Compass and the other 3 free-tier adult categories keep questions 21 to 40 for their $1.99', () => {
  for (const c of CATEGORIES) {
    const n = getCategoryQuestions(c.id).length;
    const pack = accessFor([ENTITLEMENT_ALL], c);
    for (let i = 0; i < n; i++) assert.equal(isQuestionOpen(c, i, pack, LIMITED), i < PACK_QUESTION_LIMIT, `${c.id} ${i}`);
    assert.equal(openQuestionCount(c, pack, LIMITED), Math.min(n, 20), c.id);
  }
  // adult: the per-category unlock still opens the whole category (its one tranche)
  for (const c of adult) {
    assert.equal(openQuestionCount(c, accessFor([entitlementForCategory(c.id)], c), LIMITED), getCategoryQuestions(c.id).length, c.id);
  }
  // 4 adult categories have 40 questions, so the pack alone leaves 20 each behind the $1.99
  assert.deepEqual(
    adult.filter((c) => getCategoryQuestions(c.id).length > 20).map((c) => c.id).sort(),
    ['career-climber', 'moral-compass', 'social-blunders', 'tech-dystopia'],
  );
});

test('TARGET (4c): a tranche opens only its own questions beyond 20; the pack plus a tranche opens the first 20 and that tranche', () => {
  const g = cat('giggle-factory');
  const list = getCategoryQuestions(g.id).map((q) => q.id);
  const owns1 = accessFor([ENTITLEMENT_ALL, entitlementForTranche('giggle-factory', 1)], g);
  list.forEach((_, i) => assert.equal(isQuestionOpen(g, i, owns1, LIMITED), i < 40, `question ${i}`));
  const onlyTranche1 = accessFor([entitlementForTranche('giggle-factory', 1)], g); // no pack
  list.forEach((_, i) => assert.equal(isQuestionOpen(g, i, onlyTranche1, LIMITED), i < 8 || (i >= 20 && i < 40), `question ${i}`));
});

test('questionZone and the paywall at the boundaries (Giggle Factory: 8 free, pack 9 to 20, then tranches of 20 and 15)', () => {
  const g = cat('giggle-factory');
  assert.deepEqual(questionZone(g, 7), { free: true, pack: false, tranche: 0 });
  assert.deepEqual(questionZone(g, 8), { free: false, pack: true, tranche: 0 });
  assert.deepEqual(questionZone(g, 19), { free: false, pack: true, tranche: 0 });
  assert.deepEqual(questionZone(g, 20), { free: false, pack: false, tranche: 1 });
  assert.deepEqual(questionZone(g, 39), { free: false, pack: false, tranche: 1 });
  assert.deepEqual(questionZone(g, 40), { free: false, pack: false, tranche: 2 });
  assert.deepEqual(questionZone(g, 54), { free: false, pack: false, tranche: 2 });
  assert.equal(nextTrancheToSell(g, noAccess(), LIMITED)?.k, 1);
  const owns1: Access = { all: false, pack: true, ownedTranches: new Set([1]) };
  assert.equal(nextTrancheToSell(g, owns1, LIMITED)?.k, 2);
  assert.equal(nextTrancheToSell(g, { all: false, pack: true, ownedTranches: new Set([1, 2]) }, LIMITED), null);
  assert.equal(isCategoryFullyOpen(g, { all: false, pack: true, ownedTranches: new Set([1, 2]) }, LIMITED), true);
});

test('adult paywall (target): a premium-tier adult category the pack already opens fully has nothing left to sell', () => {
  const h = cat('high-life'); // 20 questions: the pack covers all of them
  assert.equal(nextTrancheToSell(h, accessFor([ENTITLEMENT_ALL], h), LIMITED), null);
  assert.equal(nextTrancheToSell(h, noAccess(), LIMITED)?.k, 1);
  const m = cat('moral-compass'); // 40 questions: tranche 1 is questions 21 to 40
  assert.equal(nextTrancheToSell(m, accessFor([ENTITLEMENT_ALL], m), LIMITED)?.k, 1);
});

test('refund example: tranche 1 refunded, tranche 2 still owned opens exactly tranche 2 (plus the pack zone) and the paywall offers tranche 1', () => {
  const g = cat('giggle-factory');
  const access = accessFor([ENTITLEMENT_ALL, entitlementForTranche('giggle-factory', 2)], g);
  assert.deepEqual([...access.ownedTranches], [2]);
  const n = getCategoryQuestions(g.id).length;
  const open = Array.from({ length: n }, (_, i) => isQuestionOpen(g, i, access, LIMITED));
  open.forEach((o, i) => assert.equal(o, i < 20 || i >= 40, `question ${i}`));
  assert.equal(openQuestionCount(g, access, LIMITED), 20 + 15);
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

test('an owned tranche set of every tranche fully opens a category with the pack', () => {
  const g = cat('giggle-factory');
  const both = [ENTITLEMENT_ALL, entitlementForTranche('giggle-factory', 1), entitlementForTranche('giggle-factory', 2)];
  assert.equal(isCategoryFullyOpen(g, accessFor(both, g), LIMITED), true);
  assert.equal(isCategoryFullyOpen(g, accessFor(both.slice(0, 2), g), LIMITED), false);
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
