import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COPYRIGHT_LINE, SUPPORT_EMAIL } from '../../constants/legal';

const privacy = readFileSync('app/privacy.tsx', 'utf8');
const support = readFileSync('app/support.tsx', 'utf8');

test('privacy policy no longer makes stale claims', () => {
  assert.doesNotMatch(privacy, /does not use any analytics/i);
  assert.doesNotMatch(privacy, /Only one answer per question is counted for\s+each device/i);
});

test('privacy policy covers the iOS app data practices', () => {
  for (const word of ['PostHog', 'RevenueCat', 'Kids & Family', 'Data Deletion', 'SUPPORT_EMAIL']) {
    assert.ok(privacy.includes(word), `privacy.tsx should mention ${word}`);
  }
});

test('support page exists with contact and restore help', () => {
  assert.ok(support.includes('SUPPORT_EMAIL'));
  assert.match(support, /Restore Purchases/);
});

test('copyright line and contact are set', () => {
  assert.match(COPYRIGHT_LINE, /^© 2026 \S/);
  assert.match(SUPPORT_EMAIL, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
});
