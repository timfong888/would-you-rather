import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsOnFor, createTracker, propsAreKids, type AnalyticsClient } from '../../lib/analyticsCore';
import { isKidsPath } from '../../lib/kidsPaths';

function setup(platform: string, path: { current: string | null }) {
  const sent: string[] = [];
  const client: AnalyticsClient = {
    capture: (e) => void sent.push(`capture:${e}`),
    identify: (id) => void sent.push(`identify:${id}`),
  };
  const tracker = createTracker({
    getClient: () => client,
    allowed: () => analyticsOnFor({ platform, pathname: path.current, isKids: isKidsPath }),
  });
  return { sent, ...tracker };
}

const KIDS = [
  '/game/kf-1',
  '/p/kf-9',
  '/results/kf-3',
  '/categories/kids-family',
  '/complete/kids-family',
  '/unlock/kids-family',
  '/would-you-rather-questions-for-kids',
  '/dinner-table-conversation-starters/',
];

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: kids routes send nothing (no events, no identify)`, () => {
    for (const p of KIDS.filter((k) => isKidsPath(k))) {
      const path = { current: p };
      const t = setup(platform, path);
      t.track('session_start');
      t.track('question_answered', { question_id: 'kf-1' });
      t.identify('visitor-1');
      assert.deepEqual(t.sent, [], `${platform} ${p}`);
    }
  });
}

test('the kids sample set really is kids routes', () => {
  assert.ok(KIDS.filter(isKidsPath).length >= 7);
});

test('ios: adult routes send events and identify', () => {
  const t = setup('ios', { current: '/game/hl-1' });
  t.identify('v');
  t.track('question_answered', { question_id: 'hl-1' });
  assert.deepEqual(t.sent, ['identify:v', 'capture:question_answered']);
});

test('ios: nothing is sent until the route is known (fails closed)', () => {
  const t = setup('ios', { current: null });
  t.track('session_start');
  t.identify('v');
  assert.deepEqual(t.sent, []);
});

test('ios: moving from an adult to a kids screen stops events, and back resumes', () => {
  const path = { current: '/game/hl-1' as string | null };
  const t = setup('ios', path);
  t.track('a');
  path.current = '/game/kf-2';
  t.track('b');
  path.current = '/categories';
  t.track('c');
  assert.deepEqual(t.sent, ['capture:a', 'capture:c']);
});

test('kids content in event props is dropped even on an adult route', () => {
  const t = setup('ios', { current: '/results/hl-1' });
  t.track('share_clicked', { question_id: 'kf-4' });
  t.track('paywall_viewed', { category_id: 'tiny-choices' });
  assert.deepEqual(t.sent, []);
  assert.equal(propsAreKids({ question_id: 'hl-1' }), false);
});

test('web: adult routes still send', () => {
  const t = setup('web', { current: '/categories' });
  t.track('x');
  assert.deepEqual(t.sent, ['capture:x']);
});

import { stripIp, POSTHOG_PRIVACY_OPTIONS } from '../../lib/analyticsCore';

test('stripIp removes $ip from properties, $set and $set_once and keeps everything else', () => {
  const e: any = {
    event: 'page_view',
    properties: { $ip: '203.0.113.9', path: '/feed', platform: 'web' },
    $set: { $ip: '203.0.113.9', plan: 'free' },
    $set_once: { $ip: '203.0.113.9', first_channel: 'direct' },
  };
  const out: any = stripIp(e);
  assert.equal('$ip' in out.properties, false);
  assert.equal('$ip' in out.$set, false);
  assert.equal('$ip' in out.$set_once, false);
  assert.equal(out.properties.path, '/feed');
  assert.equal(out.$set.plan, 'free');
  assert.equal(out.$set_once.first_channel, 'direct');
});

test('stripIp tolerates events with no property bags', () => {
  assert.deepEqual(stripIp({ event: 'x' } as any), { event: 'x' });
  assert.doesNotThrow(() => stripIp({ event: 'x', properties: null } as any));
});

test('the PostHog privacy options disable GeoIP and strip $ip before send', () => {
  assert.equal(POSTHOG_PRIVACY_OPTIONS.disableGeoip, true);
  const out: any = POSTHOG_PRIVACY_OPTIONS.before_send({ event: 'e', properties: { $ip: '1.2.3.4', a: 1 } });
  assert.equal('$ip' in out.properties, false);
  assert.equal(out.properties.a, 1);
});
