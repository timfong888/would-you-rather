import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownerCodeAllowed } from '../../lib/ownerAccessPolicy';

test('owner code stays on web and in native dev builds', () => {
  assert.equal(ownerCodeAllowed('web', false), true);
  assert.equal(ownerCodeAllowed('web', true), true);
  assert.equal(ownerCodeAllowed('ios', true), true);
  assert.equal(ownerCodeAllowed('android', true), true);
});

test('owner code is disabled in native release builds (TestFlight, App Store, Play)', () => {
  assert.equal(ownerCodeAllowed('ios', false), false);
  assert.equal(ownerCodeAllowed('android', false), false);
});
