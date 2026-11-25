import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COPY } from '../../constants/copy';
import {
  CATEGORIES,
  SELLABLE_TRANCHE_MAX,
  getNextTranche,
  getTranches,
  hasLockedRemaining,
  isTrancheStart,
  trancheSize,
} from '../../constants/questions';

const adult = CATEGORIES.filter((c) => c.audience === 'adult');
const td = adult.find((c) => c.id === 'tech-dystopia')!;
const hl = adult.find((c) => c.id === 'high-life')!;

/** Source without comments, so only strings and code are checked. */
const code = (path: string) =>
  readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('tranche copy is derived from the counts', () => {
  assert.equal(COPY.lockedBanner(5, 35), '✓ 5 free dilemmas · 👑 35 more to unlock');
  assert.equal(COPY.moreDilemmas(20), '👑 20 MORE DILEMMAS');
  assert.equal(COPY.openNext(15), 'Open the next 15 questions');
  assert.equal(COPY.openNextShort(20), 'OPEN THE NEXT 20');
});

test('the category, paywall and complete screens have no PREMIUM or EXPANSION wording and no bare FREE pill', () => {
  for (const f of ['app/categories/[id].tsx', 'app/unlock/[id].tsx', 'app/complete/[id].tsx', 'constants/copy.ts']) {
    const src = code(f);
    assert.doesNotMatch(src, /PREMIUM|EXPANSION|[Ee]xpansion pack/, f);
    assert.doesNotMatch(src, />\s*FREE\s*</, `${f} has a bare FREE label`);
  }
});

test('no screen reads the category tier any more', () => {
  for (const f of ['app/categories/[id].tsx', 'app/unlock/[id].tsx', 'app/complete/[id].tsx', 'app/game/[id].tsx', 'app/results/[id].tsx']) {
    assert.doesNotMatch(code(f), /\.tier\b/, f);
  }
});

test('next tranche: what the paywall and the upsell sell', () => {
  assert.deepEqual(getNextTranche(td, false), { k: 1, first: 6, last: 20 });
  assert.equal(trancheSize(getNextTranche(td, false)!), 15);
  assert.equal(trancheSize(getNextTranche(td, new Set([1]))!), 20);
  assert.equal(getNextTranche(td, new Set([1]))!.k, 2);
  assert.equal(getNextTranche(td, new Set([2]))!.k, 1, 'owning only tranche 2 still sells tranche 1');
  assert.equal(getNextTranche(td, new Set([1, 2])), undefined);
  assert.equal(getNextTranche(td, true), undefined);
  assert.equal(getNextTranche(hl, new Set([1])), undefined);
});

test('hasLockedRemaining: a tranche-1 buyer of a 40-question category still has something to buy', () => {
  assert.equal(hasLockedRemaining(td, false), true);
  assert.equal(hasLockedRemaining(td, new Set([1])), true);
  assert.equal(hasLockedRemaining(td, new Set([1, 2])), false);
  assert.equal(hasLockedRemaining(td, true), false);
  assert.equal(hasLockedRemaining(hl, new Set([1])), false);
  assert.equal(hasLockedRemaining(hl, false), true);
});

test('the complete-screen step happens at every tranche start, for every grown-up category', () => {
  for (const c of adult) {
    for (const t of getTranches(c)) assert.equal(isTrancheStart(c, t.first - 1), true, `${c.id} tranche ${t.k}`);
    assert.equal(isTrancheStart(c, 0), false, c.id);
    assert.equal(isTrancheStart(c, 4), false, c.id);
  }
  assert.equal(isTrancheStart(td, 5), true);
  assert.equal(isTrancheStart(td, 20), true);
  const kids = CATEGORIES.find((c) => c.audience === 'kids')!;
  assert.equal(isTrancheStart(kids, 8), true, 'kids keep their single step at the end of the free 8');
});

test('tranche 2 has no store product yet: only tranche 1 is sellable until step F5', () => {
  assert.equal(SELLABLE_TRANCHE_MAX, 1);
});

// ---- web free unlock: one tap, one tranche (Tim, 2026-11-25) and the other F2 fixes ----
import { holdsAnyTranche, openTranchesFor, trancheEntitlementId } from '../../lib/access';
import type { AccessState } from '../../lib/access';
import {
  PUBLIC_QUESTION_COUNTS,
  getCategoryQuestions,
  getPublicQuestionCount,
  getPublicQuestions,
  isQuestionLocked,
  isQuestionPublic,
} from '../../constants/questions';

const webState = (grants: string[], enabled = true): AccessState => ({
  ownerAccess: false,
  entitlements: new Set(),
  testUnlocks: new Set(grants),
  testUnlockEnabled: enabled,
});

test('web free unlock: each tap grants one tranche, in the same order as iPhone', () => {
  assert.equal(trancheEntitlementId('tech-dystopia', 1), 'cat_tech-dystopia');
  assert.equal(trancheEntitlementId('tech-dystopia', 2), 'cat_tech-dystopia_2');
  const none = openTranchesFor(webState([]), td) as Set<number>;
  assert.deepEqual([...none], []);
  // tap 1: the next unowned tranche is 1
  const tap1 = openTranchesFor(webState([trancheEntitlementId('tech-dystopia', getNextTranche(td, none)!.k)]), td) as Set<number>;
  assert.deepEqual([...tap1], [1]);
  assert.equal(isQuestionLocked(td, 19, tap1), false);
  assert.equal(isQuestionLocked(td, 20, tap1), true, 'question 21 is still locked after one tap');
  // tap 2: the next unowned tranche is 2
  assert.equal(getNextTranche(td, tap1)!.k, 2);
  const tap2 = openTranchesFor(webState(['cat_tech-dystopia', 'cat_tech-dystopia_2']), td) as Set<number>;
  assert.deepEqual([...tap2].sort(), [1, 2]);
  assert.equal(hasLockedRemaining(td, tap2), false);
});

test('web free unlock: a 20-question category needs one tap; the old category-id unlock and the all-pack still open everything', () => {
  const hlAfterOne = openTranchesFor(webState(['cat_high-life']), hl) as Set<number>;
  assert.equal(hasLockedRemaining(hl, hlAfterOne), false);
  assert.equal(openTranchesFor(webState(['tech-dystopia']), td), true, 'unlocks stored by the earlier web free unlock keep working');
  assert.equal(openTranchesFor(webState(['premium_all']), td), true);
  assert.deepEqual([...(openTranchesFor(webState(['cat_tech-dystopia'], false), td) as Set<number>)], [], 'ignored when the free unlock is off');
});

test('restore wording counts any tranche of the category, including only tranche 2', () => {
  assert.equal(holdsAnyTranche(['cat_tech-dystopia_2'], 'tech-dystopia'), true);
  assert.equal(holdsAnyTranche(['cat_tech-dystopia'], 'tech-dystopia'), true);
  assert.equal(holdsAnyTranche(['premium_all'], 'tech-dystopia'), true);
  assert.equal(holdsAnyTranche(['cat_high-life'], 'tech-dystopia'), false);
  assert.equal(holdsAnyTranche(['cat_tech-dystopia-x'], 'tech-dystopia'), false);
  assert.equal(holdsAnyTranche([], 'tech-dystopia'), false);
});

test('the public (SEO) set is pinned per category and does not move with tier or the free count', () => {
  for (const c of CATEGORIES) {
    const pinned = PUBLIC_QUESTION_COUNTS[c.id];
    assert.ok(pinned !== undefined, `${c.id} has no pinned public count`);
    const n = getCategoryQuestions(c.id).length;
    assert.equal(getPublicQuestionCount(c), Math.min(pinned, n), c.id);
    for (const tier of ['free', 'premium'] as const) {
      assert.equal(getPublicQuestionCount({ ...c, tier }), getPublicQuestionCount(c), `${c.id} retagged ${tier}`);
    }
    assert.equal(getPublicQuestions(c).length, getPublicQuestionCount(c), c.id);
  }
  // Tim, 2026-11-25: questions 6 to 20 of the four categories stay public.
  for (const id of ['moral-compass', 'social-blunders', 'career-climber', 'tech-dystopia'] as const) {
    const c = adult.find((x) => x.id === id)!;
    assert.equal(getPublicQuestionCount(c), 20, id);
    assert.equal(isQuestionPublic(c, 19), true, id);
    assert.equal(isQuestionPublic(c, 20), false, id);
  }
  for (const id of ['high-life', 'midnight-secrets', 'time-traveler', 'deep-desires', 'wildest-dreams'] as const) {
    assert.equal(getPublicQuestionCount(adult.find((x) => x.id === id)!), 3, id);
  }
});

test('the home count is the grown-up questions, matching its 9 categories', () => {
  const src = code('app/index.tsx');
  assert.match(src, /TOTAL_QUESTIONS = GROWNUP_CATEGORIES\.reduce/);
  assert.equal(adult.reduce((sum, c) => sum + getCategoryQuestions(c.id).length, 0), 260);
});

// ── Sinatra findings on #242 ────────────────────────────────────────────────
import { endsOpenSet, hasAnyTranche } from '../../constants/questions';

test('settings lists a category when any tranche is owned, including web per-tranche unlocks', () => {
  assert.equal(hasAnyTranche(false), false);
  assert.equal(hasAnyTranche(new Set<number>()), false);
  assert.equal(hasAnyTranche(new Set([1])), true);
  assert.equal(hasAnyTranche(new Set([2])), true);
  assert.equal(hasAnyTranche(true), true);
  const src = code('app/settings.tsx');
  assert.match(src, /hasAnyTranche\(openTranches\(cat\)\)/);
  assert.doesNotMatch(src, /isUnlocked\(cat\.id\)/);
});

test('only the last open question before a paid tranche goes to the complete screen', () => {
  const none = new Set<number>();
  assert.equal(endsOpenSet(td, 4, none), true); // Q5 -> Q6 locked
  assert.equal(endsOpenSet(td, 19, new Set([1])), true); // Q20 open (owned) -> Q21 locked
  // share recipient on locked Q20 with nothing owned: Q21 is not a tranche start, and Q20 is locked
  assert.equal(endsOpenSet(td, 19, none), false);
  assert.equal(endsOpenSet(td, 5, none), false); // locked current question
  const game = code('app/game/[id].tsx');
  const results = code('app/results/[id].tsx');
  assert.match(game, /endsOpenSet\(category, currentIdx, openTranches\(category\)\)/);
  assert.match(results, /endsOpenSet\(category, currentIdx, openTranches\(category\)\)/);
});

test('complete screen does not call bought questions free', () => {
  const src = code('app/complete/[id].tsx');
  assert.doesNotMatch(src, /played all \$\{completedCount\} free/);
  assert.match(src, /played all \$\{completedCount\} \$\{category\.label\}/);
});
