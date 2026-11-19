import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareLink, SHARE_FEEDBACK } from '../../lib/shareQuestion';

const base = { title: 'WYR', text: 'A — OR — B', url: 'https://www.wouldyourather.fyi/p/kf-2?link_id=x&gen=1' };

test('uses the native share sheet when the browser has one', async () => {
  let seen: any;
  const out = await shareLink({ ...base, nav: { share: async (d) => { seen = d; } } });
  assert.equal(out, 'shared');
  assert.equal(seen.url, base.url);
});

test('copies the link when there is no share sheet (desktop, or Brave without navigator.share)', async () => {
  let copied = '';
  const out = await shareLink({ ...base, nav: { clipboard: { writeText: async (s) => { copied = s; } } } });
  assert.equal(out, 'copied');
  assert.equal(copied, base.url);
  assert.equal(SHARE_FEEDBACK[out], 'Link copied!');
});

test('a closed share sheet does not also copy the link', async () => {
  let copied = false;
  const out = await shareLink({
    ...base,
    nav: {
      share: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); },
      clipboard: { writeText: async () => { copied = true; } },
    },
  });
  assert.equal(out, 'cancelled');
  assert.equal(copied, false);
});

test('a failing share sheet falls back to the clipboard, then to the legacy copy', async () => {
  const shareFails = async () => { throw new Error('NotAllowedError'); };
  assert.equal(await shareLink({ ...base, nav: { share: shareFails, clipboard: { writeText: async () => {} } } }), 'copied');
  assert.equal(await shareLink({ ...base, nav: { share: shareFails, clipboard: { writeText: async () => { throw new Error('denied'); } } }, legacyCopy: () => true }), 'copied');
  assert.equal(await shareLink({ ...base, nav: {}, legacyCopy: () => true }), 'copied');
});

test('reports failure only when nothing worked, and says so', async () => {
  const out = await shareLink({ ...base, nav: {}, legacyCopy: () => false });
  assert.equal(out, 'failed');
  assert.ok(SHARE_FEEDBACK.failed);
});

test('native uses Share.share with the text and link', async () => {
  let seen: any;
  const out = await shareLink({ ...base, nativeShare: (o) => { seen = o; } });
  assert.equal(out, 'shared');
  assert.match(seen.message, /A — OR — B/);
  assert.equal(seen.url, base.url);
});

import { buildShareLink, shareEvents } from '../../lib/shareQuestion';

const o = 'https://www.wouldyourather.fyi';

test('adult share link carries link_id and generation', () => {
  assert.equal(
    buildShareLink({ origin: o, questionId: 'sb-1', linkId: 'abc', generation: 2, kids: false }),
    `${o}/p/sb-1?link_id=abc&gen=2`,
  );
});

test('kids share link is the bare question URL: no link_id, no generation', () => {
  const url = buildShareLink({ origin: o, questionId: 'kf-2', linkId: 'abc', generation: 2, kids: true });
  assert.equal(url, `${o}/p/kf-2`);
  assert.ok(!url.includes('?') && !url.includes('link_id') && !url.includes('gen='));
});

test('a kids share sends no analytics events, even when arriving via a share link', () => {
  const ev = shareEvents({
    kids: true, questionId: 'kf-2', surface: 'game_result', linkId: '',
    visitorId: 'v1', incomingLinkId: 'in1', incomingGeneration: 3,
  });
  assert.deepEqual(ev, []);
});

test('an adult share sends share_clicked, plus visitor_shared_after_link when it came from a link', () => {
  const plain = shareEvents({ kids: false, questionId: 'sb-1', surface: 'game_result', linkId: 'n1', visitorId: 'v1', incomingGeneration: 0 });
  assert.deepEqual(plain.map((e) => e.name), ['share_clicked']);
  assert.equal(plain[0].props.surface, 'game_result');
  const chained = shareEvents({ kids: false, questionId: 'sb-1', surface: 'game_result', linkId: 'n1', visitorId: 'v1', incomingLinkId: 'in1', incomingGeneration: 1 });
  assert.deepEqual(chained.map((e) => e.name), ['share_clicked', 'visitor_shared_after_link']);
  assert.equal(chained[1].props.new_link_id, 'n1');
});
