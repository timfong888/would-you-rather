import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain .mjs module
import { matchesApp, stateLabel, isLive } from '../../scripts/lib/ascApps.mjs';

test('matches name or bundle ID, case-insensitive', () => {
  assert.equal(matchesApp({ name: 'Neville', bundleId: 'com.fong888.neville' }, 'neville'), true);
  assert.equal(matchesApp({ name: 'Other', bundleId: 'pckg.NEVILLE' }, 'neville'), true);
  assert.equal(matchesApp({ name: 'Would You Rather', bundleId: 'com.timfong888.wouldyourather' }, 'neville'), false);
  assert.equal(matchesApp({ name: 'x', bundleId: 'y' }, ''), true);
  assert.equal(matchesApp({}, 'neville'), false);
});

test('READY_FOR_SALE is live, other states are not', () => {
  const v = (s: string) => ({ attributes: { appStoreState: s } });
  assert.equal(isLive([v('READY_FOR_SALE')]), true);
  assert.equal(isLive([v('IN_REVIEW'), v('READY_FOR_SALE')]), true);
  assert.equal(isLive([v('PREPARE_FOR_SUBMISSION'), v('DEVELOPER_REMOVED_FROM_SALE')]), false);
  assert.equal(isLive([]), false);
  assert.equal(isLive(undefined), false);
});

test('state labels are plain', () => {
  assert.match(stateLabel('READY_FOR_SALE'), /LIVE/);
  assert.match(stateLabel('DEVELOPER_REMOVED_FROM_SALE'), /REMOVED/);
  assert.equal(stateLabel('IN_REVIEW'), 'in review');
  assert.equal(stateLabel('PREPARE_FOR_SUBMISSION'), 'prepare for submission');
  assert.equal(stateLabel(undefined), 'unknown');
});
