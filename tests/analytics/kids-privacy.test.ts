// Kids routes collect and persist nothing (#51, #65, Vercel Security Review on #85).
// Runs with tests/tsconfig.analytics.json, which swaps react-native and PostHog for stubs.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { calls } from '../stubs/posthog';

type Store = Map<string, string>;
const local: Store = new Map();
const session: Store = new Map();
const writes: string[] = [];
const mkStorage = (m: Store, name: string) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => { writes.push(`${name}.set ${k}`); m.set(k, v); },
  removeItem: (k: string) => void m.delete(k),
  key: (i: number) => [...m.keys()][i] ?? null,
  get length() { return m.size; },
});
const win: any = { location: { pathname: '/', search: '', href: 'https://www.wouldyourather.fyi/', host: 'www.wouldyourather.fyi', hostname: 'www.wouldyourather.fyi' } };
(globalThis as any).window = win;
(globalThis as any).document = { referrer: '', cookie: '' };
(globalThis as any).localStorage = mkStorage(local, 'local');
(globalThis as any).sessionStorage = mkStorage(session, 'session');
win.localStorage = (globalThis as any).localStorage;
process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';

const go = (path: string, search = '', referrer = '') => {
  win.location.pathname = path;
  win.location.search = search;
  win.location.href = `https://www.wouldyourather.fyi${path}${search}`;
  (globalThis as any).document.referrer = referrer;
};

let n = 0;
// A fresh module instance per test = a fresh page load (storage persists, like a browser).
// @ts-ignore dynamic import with a cache-busting query needs a newer --module than the Expo base config
const load = async () => (await import(`../../lib/analytics?load=${++n}`)) as typeof import('../../lib/analytics');

beforeEach(() => {
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
  assert.ok(calls.some((c) => c.op === 'optOut') && calls.some((c) => c.op === 'reset'));
  assert.ok(!local.has('wyr_visitor_id') && !local.has('ph_phc_test_posthog'), 'persisted IDs cleared');
  const before = captures().length;
  a.track('page_view', { path: '/would-you-rather-questions-for-kids' });
  a.track('question_answered', { question_id: 'kf-3' });
  assert.equal(captures().length, before, 'nothing captured on the kids page');
  assert.notEqual(a.getOrCreateVisitorId().id, s.visitorId, 'kids pages never reuse the adult id');
  assert.ok(!local.has('wyr_visitor_id'));

  // Back to an adult page: capture resumes without the adult first-touch or the old referrer.
  go('/categories');
  a.syncKidsMode('/categories');
  assert.ok(calls.some((c) => c.op === 'optIn'));
  a.track('page_view', { path: '/categories' });
  const p = sentProps().at(-1)!;
  assert.ok(!('first_utm_campaign' in p) && !('referrer' in p));
});
