import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipientEvents, recipientIntro, theyPickedLine } from '../../lib/recipient';
import { MATCH_COPY } from '../../lib/matchShare';

const base = { questionId: 'q1', category: 'funny', linkId: 'L', generation: 1, visitorId: 'v', friend: 'A' as const };

test('kids items send no recipient events, for every action', () => {
  for (const a of ['answered', 'play_another', 'send_back', 'app_cta_click'] as const) {
    assert.deepEqual(recipientEvents(a, { ...base, kids: true, questionId: 'kf-17' }), []);
  }
});

test('adult funnel event names and props', () => {
  const names = (['answered', 'play_another', 'send_back', 'app_cta_click'] as const).map(
    (a) => recipientEvents(a, { ...base, kids: false })[0].name,
  );
  assert.deepEqual(names, ['shared_link_answered', 'shared_link_play_another', 'shared_link_send_back', 'app_cta_click']);
  const [ev] = recipientEvents('answered', { ...base, kids: false, outcome: 'matched' });
  assert.equal(ev.props.source, 'shared_link');
  assert.equal(ev.props.link_id, 'L');
  assert.equal(ev.props.friend_pick_in_link, true);
  assert.equal(ev.props.matched, true);
});

test('recipient events never carry the pick itself', () => {
  for (const friend of ['A', 'B', 'ask', null] as const) {
    const [ev] = recipientEvents('answered', { ...base, kids: false, friend, outcome: friend === 'ask' ? null : 'different' });
    for (const v of Object.values(ev.props)) assert.ok(v !== 'A' && v !== 'B', JSON.stringify(ev.props));
  }
});

test('intro line depends on what the link carries', () => {
  assert.equal(recipientIntro(false, 'B'), MATCH_COPY.adult.ui.recipient_intro_pick);
  assert.equal(recipientIntro(false, 'ask'), MATCH_COPY.adult.ui.recipient_intro_ask);
  assert.equal(recipientIntro(false, null), MATCH_COPY.adult.ui.recipient_intro_plain);
  assert.equal(recipientIntro(true, 'A'), MATCH_COPY.kids.ui.recipient_intro_pick);
});

test('they picked line names the option', () => {
  assert.equal(theyPickedLine(false, 'Fly'), 'They picked: Fly');
});

test('kids and adult ui have the same keys', () => {
  assert.deepEqual(Object.keys(MATCH_COPY.kids.ui).sort(), Object.keys(MATCH_COPY.adult.ui).sort());
});

import { appStoreUrl, shareCampaign, smartBannerContent, isIphoneBrowser, addSmartBanner, APP_STORE_LIVE } from '../../lib/appStore.js';

test('App Store link carries campaign params and no user data', () => {
  const u = new URL(appStoreUrl({ campaign: 'share_p', providerToken: '123' }));
  assert.equal(u.host, 'apps.apple.com');
  assert.equal(u.pathname, '/app/apple-store/id6836653723');
  assert.deepEqual([...u.searchParams.keys()].sort(), ['ct', 'mt', 'pt']);
  assert.equal(u.searchParams.get('ct'), 'share_p');
  assert.equal(new URL(appStoreUrl({ campaign: 'x', providerToken: '' })).searchParams.has('pt'), false);
  assert.equal(shareCampaign(true), 'share_p_kids');
  assert.equal(shareCampaign(false), 'share_p');
});

test('Get the app is off by default (TestFlight only)', () => {
  assert.equal(APP_STORE_LIVE, false);
});

test('Smart App Banner meta', () => {
  assert.equal(smartBannerContent(), 'app-id=6836653723');
  const out = addSmartBanner('<html><head><title>x</title></head></html>');
  assert.ok(out.includes('<meta name="apple-itunes-app" content="app-id=6836653723" /></head>'));
  assert.equal(addSmartBanner(out), out, 'idempotent');
  assert.throws(() => addSmartBanner('<html></html>'));
});

test('iPhone browser detection', () => {
  assert.equal(isIphoneBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari'), true);
  assert.equal(isIphoneBrowser('Mozilla/5.0 (Linux; Android 14) Chrome'), false);
  assert.equal(isIphoneBrowser(undefined), false);
});
