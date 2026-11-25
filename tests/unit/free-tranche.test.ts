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
  assert.equal(isTrancheStart(kids, 5), true, 'kids use the same tranche start as grown-ups');
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

test('web free unlock: a 20-question category needs one tap; the old category-id unlock opens tranche 1 only; the all-pack opens everything', () => {
  const hlAfterOne = openTranchesFor(webState(['cat_high-life']), hl) as Set<number>;
  assert.equal(hasLockedRemaining(hl, hlAfterOne), false);
  assert.deepEqual([...(openTranchesFor(webState(['tech-dystopia']), td) as Set<number>)], [1], 'the earlier web free unlock opens tranche 1 only');
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

// ── Review findings on 1108b6e (restore rule, overlay, stale strings, marker guard) ──
import { restoreOpensTranche } from '../../lib/access';
import { readdirSync, statSync } from 'node:fs';

test('restore succeeds only when the restored entitlements open the tranche the paywall offers', () => {
  const T = td; // 40 questions: tranche 1 = 6-20, tranche 2 = 21-40
  // tranche-1 owner on the tranche-2 paywall: not enough (the High finding)
  assert.equal(restoreOpensTranche(['cat_tech-dystopia'], T, 2), false);
  // tranche-2-only holder on the tranche-1 paywall: does not open tranche 1
  assert.equal(restoreOpensTranche(['cat_tech-dystopia_2'], T, 1), false);
  assert.equal(restoreOpensTranche(['cat_tech-dystopia'], T, 1), true);
  assert.equal(restoreOpensTranche(['cat_tech-dystopia_2'], T, 2), true);
  assert.equal(restoreOpensTranche(['cat_tech-dystopia', 'cat_tech-dystopia_2'], T, 2), true);
  assert.equal(restoreOpensTranche(['premium_all'], T, 2), true);
  assert.equal(restoreOpensTranche(['cat_high-life'], T, 1), false); // another category
  assert.equal(restoreOpensTranche([], T, 1), false);
  assert.equal(restoreOpensTranche(['cat_tech-dystopia-x'], T, 1), false);
  // kids keep the all-or-nothing rule
  const kid = CATEGORIES.find((c) => c.audience !== 'adult')!;
  assert.equal(restoreOpensTranche([`cat_${kid.id}`], kid, 1), true);
  assert.equal(restoreOpensTranche([], kid, 1), false);
  const src = code('app/unlock/[id].tsx');
  assert.match(src, /restoreOpensTranche\(active, category, nextTranche\?\.k \?\? 1\)/);
  assert.doesNotMatch(src, /holdsAnyTranche/);
  assert.equal(COPY.restoredNotIncluded, 'Your purchases were restored, but they do not include this upgrade.');
});

test('a legacy web unlock key equal to the category id opens tranche 1 only', () => {
  const state = { ownerAccess: false, entitlements: new Set<string>(), testUnlocks: new Set([td.id]), testUnlockEnabled: true };
  const open = openTranchesFor(state, td);
  assert.ok(open instanceof Set);
  assert.deepEqual([...(open as Set<number>)], [1]);
  assert.equal(isQuestionLocked(td, 10, open), false);
  assert.equal(isQuestionLocked(td, 20, open), true); // Q21 stays locked
  const off = openTranchesFor({ ...state, testUnlockEnabled: false }, td);
  assert.equal((off as Set<number>).size, 0);
  const all = openTranchesFor({ ...state, testUnlocks: new Set(['premium_all']) }, td);
  assert.equal(all, true);
});

test('the success overlay names the tranche that opened, not the whole category', () => {
  assert.equal(COPY.unlockedBody(20), '20 more dilemmas are now yours to explore.');
  const src = code('app/unlock/[id].tsx');
  assert.doesNotMatch(src, /Category Unlocked!/);
  assert.doesNotMatch(src, /All \{questions\.length\} dilemmas/);
  assert.match(src, /COPY\.unlockedBody\(purchasedSizeRef\.current\)/);
});

test('stale strings are gone', () => {
  assert.doesNotMatch(code('app/unlock/[id].tsx'), /ONE-TIME CATEGORY UNLOCK/);
  assert.doesNotMatch(code('app/settings.tsx'), /Every pack and expansion/);
  const doc = readFileSync('docs/payments.md', 'utf8');
  assert.doesNotMatch(doc, /the price reads "Free"/);
  assert.match(doc, /\$1\.99 with "FREE FOR NOW/);
});

function appFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(p).isDirectory() ? appFiles(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

test('every app file that carries the FREE FOR NOW marker tests the env flag inline', () => {
  const offenders = appFiles('app').filter((p) => {
    const src = code(p);
    return /free for now/i.test(src) && !/process\.env\.EXPO_PUBLIC_WEB_FREE_UNLOCK === '1'/.test(src);
  });
  assert.deepEqual(offenders, []);
});

test('the all-categories unlock reports what it opens, not one tranche', () => {
  const src = code('app/unlock/[id].tsx');
  assert.match(src, /purchasedSizeRef\.current = kind === 'all' \? remainingLocked : nextSize;/);
  assert.equal((src.match(/purchasedSizeRef\.current = /g) ?? []).length, 4);
  assert.match(src, /^        purchasedSizeRef\.current = nextSize;$/m); // restore branch, indented with its block
});

// ── Follow-up batch on 4f4560c: late redirect, completed count, owner code, wording ──
import { offeredTrancheOpen } from '../../lib/access';
import { openPrefixCount } from '../../constants/questions';

test('a late entitlement for the tranche the paywall offered ends the paywall, even with more to sell', () => {
  // tranche 1 offered; cat_<id> arrives; tranche 2 of a 40-question category is still unowned
  assert.equal(offeredTrancheOpen(new Set([1]), 1), true);
  assert.equal(offeredTrancheOpen(new Set([2]), 1), false);
  assert.equal(offeredTrancheOpen(new Set<number>(), 1), false);
  assert.equal(offeredTrancheOpen(false, 1), false);
  assert.equal(offeredTrancheOpen(true, 2), true);
  assert.equal(offeredTrancheOpen(new Set([1]), undefined), false);
  // and the paywall would still have something to sell, which is why nothingToSell alone strands the buyer
  assert.equal(hasLockedRemaining(td, new Set([1])), true);
  const src = code('app/unlock/[id].tsx');
  assert.match(src, /offeredKRef\.current = nextTranche\?\.k \?\? 1;/);
  assert.match(src, /const unlockedNow = nothingToSell \|\| offeredTrancheOpen\(access, offeredKRef\.current\);/);
});

test('completed count is the open run from question 1, not every accessible question', () => {
  const n = getCategoryQuestions(td.id).length;
  assert.equal(openPrefixCount(td, false), 5);
  assert.equal(openPrefixCount(td, new Set([1])), 20);
  assert.equal(openPrefixCount(td, new Set([1, 2])), n);
  assert.equal(openPrefixCount(td, true), n);
  // refunded tranche 1 with tranche 2 kept: Q21-40 are open but were not played
  assert.equal(openPrefixCount(td, new Set([2])), 5);
  assert.match(code('app/complete/[id].tsx'), /const completedCount = openPrefixCount\(category, access\);/);
});

test('owner-code redemption sets the start question and says everything is unlocked', () => {
  const src = code('app/unlock/[id].tsx');
  const owner = src.slice(src.indexOf('const handleRedeemCode'), src.indexOf('const spinAnim'));
  assert.match(owner, /purchasedStartRef\.current = trancheStart;/);
  assert.match(owner, /purchasedAllRef\.current = true;/);
  assert.equal(COPY.everythingUnlocked, 'Everything is unlocked.');
  assert.match(src, /purchasedAllRef\.current \? COPY\.everythingUnlocked : COPY\.unlockedBody\(purchasedSizeRef\.current\)/);
  assert.match(src, /purchasedAllRef\.current = kind === 'all';/);
});

test('the all-categories wording and the access.ts comment match the behaviour', () => {
  const access = readFileSync('lib/access.ts', 'utf8');
  assert.doesNotMatch(access, /keyed by category id \(the old web free unlock\) or by ENTITLEMENT_ALL opens everything/);
  assert.match(access, /ENTITLEMENT_ALL opens everything \(the bare category id of the old web free unlock opens tranche 1 only/);
});

test('the iOS smoke flow asserts the paywall strings the app actually shows (#238)', () => {
  const flow = readFileSync('.maestro/adult-paywall-smoke.yaml', 'utf8');
  const src = code('app/unlock/[id].tsx');
  // eyebrow
  assert.match(flow, /visible: "MORE DILEMMAS"/);
  assert.match(src, /^\s*MORE DILEMMAS$/m);
  assert.doesNotMatch(flow, /PREMIUM ACCESS|EXPANSION PACK/);
  // CTA label: the flow's pattern must match what the button announces
  const cta = flow.match(/element: "(Open the next \[0-9\]\+ questions for\.\*)"/);
  assert.ok(cta, 'flow scrolls to the tranche CTA');
  assert.match(`${COPY.openNext(15)} for $1.99`, new RegExp(`^${cta![1]}$`));
  assert.match(src, /\$\{COPY\.openNext\(nextSize\)\} for \$\{shownPrice\}/);
  assert.doesNotMatch(flow, /Unlock \[0-9\]\+ more dilemmas/);
  // restore
  assert.match(flow, /assertVisible: "Restore previous purchases"/);
  assert.match(src, /accessibilityLabel="Restore previous purchases"/);
});

// ---- review of #251: a kids or teen paywall sells nothing and never offers the grown-up pack ----
import { isTrancheSellable, offersAllCategoriesPack } from '../../constants/questions';

test('kids and teen sell nothing until F5, even with the web free unlock; grown-ups keep today\'s rule', () => {
  const young = CATEGORIES.filter((c) => c.audience !== 'adult');
  assert.ok(young.length >= 9);
  for (const c of young) {
    for (const t of getTranches(c)) {
      assert.equal(isTrancheSellable(c, t), false, `${c.id} tranche ${t.k}`);
      assert.equal(isTrancheSellable(c, t, true), false, `${c.id} tranche ${t.k} with the web free unlock`);
    }
    assert.equal(offersAllCategoriesPack(c), false, `${c.id} must not offer premium_all, which does not open it`);
  }
  const [t1, t2] = getTranches(td);
  assert.equal(isTrancheSellable(td, t1), true);
  assert.equal(isTrancheSellable(td, t2), false, 'tranche 2 has no product yet');
  assert.equal(isTrancheSellable(td, t2, true), true, 'the web free unlock still opens it for grown-ups');
  for (const c of adult) assert.equal(offersAllCategoriesPack(c), true, c.id);
});

test('the paywall, category and complete screens decide "sellable" with isTrancheSellable, and the pack CTA is grown-up only', () => {
  for (const f of ['app/unlock/[id].tsx', 'app/categories/[id].tsx', 'app/complete/[id].tsx']) {
    const src = code(f);
    assert.match(src, /isTrancheSellable\(/, f);
    assert.doesNotMatch(src, /nextTranche\.k <= SELLABLE_TRANCHE_MAX/, `${f} must not compare the tranche number alone`);
  }
  const unlock = code('app/unlock/[id].tsx');
  assert.match(unlock, /offersAllCategoriesPack\(category\) && \(purchasesAvailable \|\| WEB_FREE_UI\)/);
  // The only place the pack is offered or bought is behind that guard.
  assert.equal((unlock.match(/Or unlock every category/g) ?? []).length, 1);
  assert.ok(unlock.indexOf('offersAllCategoriesPack(category)') < unlock.indexOf('Or unlock every category'));
  for (const f of ['app/categories/[id].tsx', 'app/complete/[id].tsx']) {
    assert.doesNotMatch(code(f), /unlock every category|handleBuy\('all'\)|PRODUCT_ALL/i, `${f} has no all-categories purchase`);
  }
});
