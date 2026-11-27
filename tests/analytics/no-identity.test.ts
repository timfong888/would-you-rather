// Enforcement for Tim's declaration D156 (#277): "not linked" means no identity
// field may ever appear in a crash, error or analytics event payload.
// Identity fields: email, name, user_id, account_id, rc_app_user_id, idfa, advertising_id.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { local, session, go } from './_setup';
import { calls } from '../stubs/posthog';
import * as analytics from '../../lib/analytics';
import { reportError, __resetErrorTrackingForTests } from '../../lib/errorTracking';

const IDENTITY_FIELDS = [
  'email', 'name', 'user_id', 'userId',
  'account_id', 'accountId',
  'rc_app_user_id', 'rcUserId', 'revenuecat_id',
  'idfa', 'advertising_id', 'advertisingId',
];

function capturedEvents() {
  return calls
    .filter((c) => c.op === 'capture')
    .map((c) => ({ event: c.args[0] as string, props: c.args[1] as Record<string, unknown> }));
}

function findIdentityFields(props: Record<string, unknown>): string[] {
  return IDENTITY_FIELDS.filter((f) => f in props);
}

beforeEach(() => {
  analytics.__resetForTests();
  __resetErrorTrackingForTests();
  local.clear(); session.clear(); calls.length = 0;
  go('/');
  analytics.syncKidsMode('/');
});

// ── crash / error events ─────────────────────────────────────────────────────

test('$exception event carries no identity field', () => {
  reportError(new Error('boom'), 'window.onerror');
  const events = capturedEvents().filter((e) => e.event === '$exception');
  assert.equal(events.length, 1, 'one crash event must be captured');
  const leaked = findIdentityFields(events[0].props ?? {});
  assert.deepEqual(
    leaked,
    [],
    `$exception event props contain identity field(s): ${leaked.join(', ')}. ` +
      'Crash data must be "not linked" (D156 on #277).',
  );
});

test('$exception props: only expected diagnostic fields are present', () => {
  reportError(new TypeError('x is null'), 'render');
  const [ev] = capturedEvents().filter((e) => e.event === '$exception');
  const props = ev?.props ?? {};
  // reportError emits these; withGlobalProps() adds the super-prop set.
  // Update this list only after confirming the new field carries no identity data.
  const ALLOWED = new Set([
    '$exception_type', '$exception_message', '$exception_source', 'path',
    'platform',                // super prop: 'web' | 'ios' | 'android'
    'owner_access',            // super prop: boolean for owner/tester filter
    'first_channel',           // super prop: acquisition channel (non-identity)
    'first_referring_domain',  // super prop: referrer domain (non-identity)
    'first_utm_source',        // super prop: UTM parameters (non-identity)
    'first_utm_medium',
    'first_utm_campaign',
    'first_landing_path',      // super prop: first page seen (non-identity)
  ]);
  const unexpected = Object.keys(props).filter((k) => !ALLOWED.has(k));
  assert.deepEqual(
    unexpected,
    [],
    `$exception event has unexpected field(s): ${unexpected.join(', ')}. ` +
      'Add to ALLOWED only after confirming the field carries no identity data (D156 on #277).',
  );
});

test('same crash occurrence reported N times is capped, not multiplied (deduplication holds)', () => {
  const e = new Error('repeated');
  for (let i = 0; i < 10; i++) reportError(e, 'render');
  const count = capturedEvents().filter((c) => c.event === '$exception').length;
  // maxPerKey=2: the limiter caps repeated errors at 2 to absorb render loops
  // while still surfacing the problem. The important invariant is N (10) → ≤ 2.
  assert.ok(count <= 2, `same error reported 10 times produced ${count} events (expected ≤ 2)`);
  assert.ok(count >= 1, 'at least one event must be captured so the error is not silently dropped');
});

// ── regular track() events ───────────────────────────────────────────────────

test('track() events carry no identity field', () => {
  analytics.track('question_viewed', { question_id: 'hl-1', category_id: 'highlights' });
  const events = capturedEvents();
  assert.ok(events.length > 0, 'at least one event must be captured');
  for (const { event, props } of events) {
    const leaked = findIdentityFields(props ?? {});
    assert.deepEqual(
      leaked,
      [],
      `track('${event}') props contain identity field(s): ${leaked.join(', ')}. ` +
        'App Store Connect data type "Product Interaction" must remain "not linked" (D156 on #277).',
    );
  }
});

// ── identify() call uses a random UUID, not an email or account id ──────────

test('identify() is called with a UUID, not an email or account id', () => {
  analytics.ensureSessionInit();
  const identifyCalls = calls.filter((c) => c.op === 'identify');
  assert.ok(identifyCalls.length >= 1, 'identify() must be called on session init');
  for (const { args } of identifyCalls) {
    const id = args[0] as string;
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      `identify() was called with "${id}" which is not a UUID. ` +
        'The distinct_id must be a random per-install UUID, never an email, name or account id.',
    );
    assert.ok(!id.includes('@'), `identify() id "${id}" looks like an email address`);
  }
});
