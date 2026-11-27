import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORT_EMAIL, POLICY_UPDATED } from '../../constants/legal';

const policy = readFileSync('app/privacy.tsx', 'utf8');

test('support email constant is wired into the policy', () => {
  assert.ok(policy.includes('SUPPORT_EMAIL'), 'policy must reference SUPPORT_EMAIL constant');
  assert.ok(SUPPORT_EMAIL.includes('@'), 'SUPPORT_EMAIL must be a valid-looking email address');
});

test('last-updated date constant is wired up', () => {
  assert.ok(policy.includes('POLICY_UPDATED'), 'policy must reference POLICY_UPDATED');
  assert.ok(POLICY_UPDATED.length > 0, 'POLICY_UPDATED must not be empty');
});

test('Kids & Family section is present with no-analytics and grown-ups-only gate', () => {
  assert.match(policy, /Kids\s*&\s*Family/i);
  assert.match(policy, /no analytics/i);
  assert.match(policy, /grown-ups-only/i);
});

test('No Tracking section explicitly disavows trackers, data brokers and IDFA', () => {
  assert.match(policy, /not track you across/i);
  assert.match(policy, /data broker/i);
  assert.match(policy, /IDFA|Advertising Identifier/);
});

test('Diagnostics section covers crash data', () => {
  assert.match(policy, /[Dd]iagnostic/);
  assert.match(policy, /crash/i);
  assert.match(policy, /not linked/i);
});

test('Children section addresses under-13 users', () => {
  assert.match(policy, /under 13/i);
});

test('deletion instructions reference the support email constant', () => {
  assert.match(policy, /delet/i);
  assert.ok(policy.includes('SUPPORT_EMAIL'), 'deletion section must reference SUPPORT_EMAIL');
});
