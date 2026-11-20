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
