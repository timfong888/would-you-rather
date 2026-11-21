import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { purchaseErrorMessage, isPurchasePending, PURCHASE_MESSAGES } from '../../lib/purchaseErrors';

// The error TestFlight build 21 showed (#159): RevenueCat CONFIGURATION_ERROR when no store product could be fetched.
const BUILD_21 = Object.assign(
  new Error('There is an issue with your configuration. Check the underlying error for more details. None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file if one is being used).'),
  { code: '23' },
);

test('the build-21 configuration error shows the friendly "not available yet" copy', () => {
  assert.equal(purchaseErrorMessage(BUILD_21), PURCHASE_MESSAGES.unavailable);
});

test('known RevenueCat codes map to specific friendly copy', () => {
  assert.equal(purchaseErrorMessage({ code: '10' }), PURCHASE_MESSAGES.network);
  assert.equal(purchaseErrorMessage({ code: '35' }), PURCHASE_MESSAGES.network);
  assert.equal(purchaseErrorMessage({ code: '20' }), PURCHASE_MESSAGES.pending);
  assert.equal(purchaseErrorMessage({ code: '3' }), PURCHASE_MESSAGES.notAllowed);
  assert.equal(purchaseErrorMessage({ code: '6' }), PURCHASE_MESSAGES.alreadyPurchased);
  assert.equal(purchaseErrorMessage({ code: 10 }), PURCHASE_MESSAGES.network); // numeric codes too
});

test('only pre-charge codes promise "not charged"; post-charge-capable errors point at Restore (Sinatra P2)', () => {
  assert.equal(purchaseErrorMessage({ code: '5' }), PURCHASE_MESSAGES.unavailable);
  for (const c of ['7', '10', '12', '16', '35', '2', 'x']) {
    const msg = purchaseErrorMessage({ code: c });
    assert.doesNotMatch(msg, /not charged/, `code ${c}`);
    assert.match(msg, /Restore Purchases/, `code ${c}`);
  }
  assert.equal(purchaseErrorMessage(new Error('boom')), PURCHASE_MESSAGES.failed);
});

test('payment pending is recognised, so the paywall does not report it as a failure (Sinatra P3)', () => {
  assert.equal(isPurchasePending({ code: '20' }), true);
  assert.equal(isPurchasePending({ code: 20 }), true);
  for (const e of [{ code: '10' }, new Error('x'), null]) assert.equal(isPurchasePending(e), false);
  const src = readFileSync('app/unlock/[id].tsx', 'utf8');
  assert.match(src, /if \(isPurchasePending\(e\)\) \{\s*track\('purchase_pending'/);
});

test('everything else falls back to mapped copy, never the raw text', () => {
  for (const e of [BUILD_21, new Error('Something internal: stack at foo.js:1'), { code: '2', message: 'STORE_PROBLEM' }, { code: '5' }, 'string error', null, undefined, 42]) {
    const msg = purchaseErrorMessage(e);
    assert.ok(Object.values(PURCHASE_MESSAGES).includes(msg as any), `unexpected copy for ${String(e)}`);
    if (e instanceof Error) assert.ok(!msg.includes(e.message));
  }
});

test('the paywall shows only mapped copy and reports the raw error to tracking', () => {
  const src = readFileSync('app/unlock/[id].tsx', 'utf8');
  assert.match(src, /reportError\(e, 'manual'\);\s*\}\s*setPurchaseError\(purchaseErrorMessage\(e\)\);/);
  // No raw error text on screen anywhere in the paywall.
  assert.doesNotMatch(src, /setPurchaseError\([^)]*\.message/);
  assert.doesNotMatch(src, /setRestoreMsg\([^)]*\.message/);
});
