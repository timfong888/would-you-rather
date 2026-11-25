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
