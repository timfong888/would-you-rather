import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPlayCategory } from '../../lib/access';
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
