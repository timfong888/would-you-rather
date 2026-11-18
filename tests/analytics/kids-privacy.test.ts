// Kids routes collect and persist nothing (#51, #65, Vercel Security Review on #85).
// Runs with tests/tsconfig.analytics.json, which swaps react-native and PostHog for stubs.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { local, session, writes, go } from './_setup';
import { calls } from '../stubs/posthog';
import * as analytics from '../../lib/analytics';

// A fresh page load = reset the module state (storage persists, like a browser).
const load = async () => {
  analytics.__resetForTests();
  return analytics;
};

beforeEach(() => {
  analytics.__resetForTests();
  local.clear(); session.clear(); writes.length = 0; calls.length = 0;
  go('/');
});

const captures = () => calls.filter((c) => c.op === 'capture');
const sentProps = () => captures().map((c) => c.args[1] as Record<string, unknown>);

test('fresh kids landing: no attribution, IDs, storage writes or PostHog calls; later pages never see the kids landing', async () => {
  go('/game/kf-1', '?utm_campaign=kidscampaign', 'https://www.google.com/');
  const a = await load();
  assert.equal(a.ensureSessionInit(), null);
  a.syncKidsMode('/game/kf-1');
  const { id } = a.getOrCreateVisitorId(); // what flushPendingVotes / castVote call
  assert.ok(id);
  a.track('page_view', { path: '/game/kf-1' });
  a.trackVoteForActivation();
  assert.deepEqual(writes, [], 'no localStorage/sessionStorage writes on a kids route');
  assert.equal(local.size + session.size, 0);
  assert.equal(calls.length, 0, 'PostHog is not even initialised');
  assert.equal(a.getOrCreateVisitorId().id, id, 'the id lives only in memory for this page load');

  // Client-side navigation to Settings, then a track.
  go('/settings');
  a.syncKidsMode('/settings');
  a.track('page_view', { path: '/settings' });
  const props = sentProps().at(-1)!;
  for (const k of ['first_landing_path', 'first_utm_campaign', 'first_channel', 'first_referring_domain', 'utm_campaign', 'landing_path', 'referrer']) {
    assert.ok(!(k in props), `${k} must not be sent after leaving a kids landing`);
  }
  assert.ok(!local.has('wyr_first_touch'), 'no first touch persisted from the kids visit');
  assert.ok(![...local.values(), ...sentProps().map((p) => JSON.stringify(p))].some((v) => v.includes('kf-1') || v.includes('kidscampaign')));
});

test('a later non-kids visit records its own first touch, not the kids landing', async () => {
  go('/game/kf-2', '?utm_campaign=kidscampaign');
  let a = await load();
  a.syncKidsMode('/game/kf-2');
  a.track('page_view', { path: '/game/kf-2' });
  // Later visit (new page load) on an adult page, from Bing.
  go('/questions-for-couples', '', 'https://www.bing.com/');
  a = await load();
  a.syncKidsMode('/questions-for-couples');
  const s = a.ensureSessionInit()!;
  assert.equal(s.attribution.landing_path, '/questions-for-couples');
  a.track('page_view', { path: '/questions-for-couples' });
  const p = sentProps().at(-1)!;
  assert.equal(p.first_landing_path, '/questions-for-couples');
  assert.equal(p.first_channel, 'organic_search');
  assert.ok(!JSON.stringify(p).includes('kf-2'));
});

test('a first touch stored by an older build with a kids landing is discarded, not sent', async () => {
  local.set('wyr_first_touch', JSON.stringify({ channel: 'organic_search', landing_path: '/would-you-rather-questions-for-kids', utm_campaign: 'kids' }));
  go('/', '', '');
  const a = await load();
  a.ensureSessionInit();
  a.track('page_view', { path: '/' });
  const p = sentProps().at(-1)!;
  assert.ok(!JSON.stringify(p).includes('kids'));
  assert.equal(p.first_landing_path, '/');
});

test('adult page then client-side navigation into a kids page: capture stops, PostHog is reset, persisted IDs are cleared', async () => {
  go('/questions-for-couples', '?utm_campaign=adult', 'https://www.google.com/');
  const a = await load();
  a.syncKidsMode('/questions-for-couples');
  const s = a.ensureSessionInit()!;
  a.track('page_view', { path: '/questions-for-couples' });
  assert.equal(captures().length, 1);
  assert.ok(local.get('wyr_visitor_id'));
  local.set('ph_phc_test_posthog', '{"distinct_id":"x"}');

  go('/would-you-rather-questions-for-kids');
  a.syncKidsMode('/would-you-rather-questions-for-kids');
  assert.ok(calls.some((c) => c.op === 'optOut') && calls.some((c) => c.op === 'shutdown'), 'client opted out and shut down');
  assert.ok(!calls.some((c) => c.op === 'reset'), 'reset() would clear the opt-out and restart flag requests');
  assert.ok(!local.has('wyr_visitor_id') && !local.has('ph_phc_test_posthog'), 'persisted IDs cleared');
  const before = captures().length;
  const inits = calls.filter((c) => c.op === 'init').length;
  a.track('page_view', { path: '/would-you-rather-questions-for-kids' });
  assert.equal(calls.filter((c) => c.op === 'init').length, inits, 'no new PostHog client on a kids route');
  a.track('question_answered', { question_id: 'kf-3' });
  assert.equal(captures().length, before, 'nothing captured on the kids page');
  assert.notEqual(a.getOrCreateVisitorId().id, s.visitorId, 'kids pages never reuse the adult id');
  assert.ok(!local.has('wyr_visitor_id'));

  // Back to an adult page: capture resumes without the adult first-touch or the old referrer.
  go('/categories');
  a.syncKidsMode('/categories');
  a.track('page_view', { path: '/categories' });
  assert.ok(calls.some((c) => c.op === 'optIn'), 'the recreated client is opted back in on an allowed page');
  const p = sentProps().at(-1)!;
  assert.ok(!('first_utm_campaign' in p) && !('referrer' in p));
});

test('the provider is told when the allowed session ends and when a new one starts (kids landing -> adult page; adult -> kids -> adult)', async () => {
  // Kids landing: no session. Then client-side navigation to an adult page creates one.
  go('/game/kf-1');
  const a = await load();
  const seen: (string | null)[] = [];
  a.subscribeSession((s) => seen.push(s ? s.visitorId : null));
  assert.equal(a.ensureSessionInit(), null);
  assert.equal(a.getSession(), null);
  go('/settings');
  a.syncKidsMode('/settings');
  a.track('page_view', { path: '/settings' });
  const first = a.getSession()!;
  assert.ok(first.visitorId, 'a visitor id exists once an allowed page is reached');
  assert.equal(first.attribution.channel, 'internal', 'not counted as an acquisition');
  assert.deepEqual(seen, [first.visitorId]);

  // Adult -> kids -> adult: the provider hears about the end and the new session.
  go('/game/kf-3');
  a.syncKidsMode('/game/kf-3');
  go('/categories');
  a.syncKidsMode('/categories');
  a.track('page_view', { path: '/categories' });
  const second = a.getSession()!;
  assert.deepEqual(seen, [first.visitorId, null, second.visitorId]);
  assert.notEqual(second.visitorId, first.visitorId, 'a new anonymous id after kids pages');
});
