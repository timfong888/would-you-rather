import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlayCategory, paywallEntry, paywallLateUnlock, questionGate } from '../../lib/access';
import type { AccessState } from '../../lib/access';

const base: AccessState = { ownerAccess: false, entitlements: new Set(), testUnlocks: new Set(), testUnlockEnabled: false };

test('locked with no entitlement', () => {
  assert.equal(canPlayCategory(base, 'high-life'), false);
});

test('a category entitlement opens only that category', () => {
  const s = { ...base, entitlements: new Set(['cat_high-life']) };
  assert.equal(canPlayCategory(s, 'high-life'), true);
  assert.equal(canPlayCategory(s, 'moral-compass'), false);
});

test('premium_all opens every category, including ones added later', () => {
  const s = { ...base, entitlements: new Set(['premium_all']) };
  for (const id of ['high-life', 'moral-compass', 'a-category-added-next-year']) assert.equal(canPlayCategory(s, id), true);
});

test('a purchase that adds an entitlement flips access with no other state change (no reload needed)', () => {
  const before = { ...base };
  const after = { ...base, entitlements: new Set(['cat_tech-dystopia']) };
  assert.equal(canPlayCategory(before, 'tech-dystopia'), false);
  assert.equal(canPlayCategory(after, 'tech-dystopia'), true);
});

test('production ignores test unlocks and old simulated-checkout unlocks', () => {
  const s = { ...base, testUnlocks: new Set(['high-life']), testUnlockEnabled: false };
  assert.equal(canPlayCategory(s, 'high-life'), false);
});

test('test builds honor test unlocks', () => {
  const s = { ...base, testUnlocks: new Set(['high-life']), testUnlockEnabled: true };
  assert.equal(canPlayCategory(s, 'high-life'), true);
  assert.equal(canPlayCategory(s, 'moral-compass'), false);
});

test('owner access opens everything', () => {
  assert.equal(canPlayCategory({ ...base, ownerAccess: true }, 'wildest-dreams'), true);
});

test('test pack (ENTITLEMENT_ALL in test unlocks) opens every category on test builds', () => {
  const s = { ...base, testUnlocks: new Set(['premium_all']), testUnlockEnabled: true };
  for (const id of ['high-life', 'moral-compass', 'tech-dystopia', 'a-category-added-next-year']) {
    assert.equal(canPlayCategory(s, id), true);
  }
});

test('test pack is ignored on production', () => {
  const s = { ...base, testUnlocks: new Set(['premium_all']), testUnlockEnabled: false };
  assert.equal(canPlayCategory(s, 'high-life'), false);
});

test('questionGate: a locked question waits for entitlements, then goes to the paywall', () => {
  const g = (locked: boolean, arrivedViaShare: boolean, entitlementsLoaded: boolean) => questionGate({ locked, arrivedViaShare, entitlementsLoaded });
  assert.equal(g(false, false, false), 'play');
  assert.equal(g(false, false, true), 'play');
  assert.equal(g(true, true, false), 'play'); // shared question stays playable
  assert.equal(g(true, true, true), 'play');
  assert.equal(g(true, false, false), 'checking'); // a buyer's entitlements may still be loading
  assert.equal(g(true, false, true), 'paywall');
});

test('paywallEntry: decides only after load and nav; entitled visitors go to the category untracked', () => {
  const e = (entitlementsLoaded: boolean, navReady: boolean, unlocked: boolean) => paywallEntry({ entitlementsLoaded, navReady, unlocked });
  for (const unlocked of [true, false]) {
    assert.equal(e(false, true, unlocked), 'wait');
    assert.equal(e(true, false, unlocked), 'wait');
    assert.equal(e(false, false, unlocked), 'wait');
  }
  assert.equal(e(true, true, true), 'to-category');
  assert.equal(e(true, true, false), 'track-view');
});

test('paywallLateUnlock: entitlements arriving after the timeout send an idle visitor to the category (Sinatra P2)', () => {
  const base = { entryChecked: true, navReady: true, unlocked: true, idle: true, redeemingCode: false };
  // The late-fetch case: entry already decided "track-view", then the category unlocks.
  assert.equal(paywallLateUnlock(base), true);
  // Not before the entry decision (the entry effect handles that) or before navigation is ready.
  assert.equal(paywallLateUnlock({ ...base, entryChecked: false }), false);
  assert.equal(paywallLateUnlock({ ...base, navReady: false }), false);
  // Still locked: stay on the paywall.
  assert.equal(paywallLateUnlock({ ...base, unlocked: false }), false);
  // A purchase/restore in flight or its success screen, or an owner code being redeemed: those own the flow.
  assert.equal(paywallLateUnlock({ ...base, idle: false }), false);
  assert.equal(paywallLateUnlock({ ...base, redeemingCode: true }), false);
});
