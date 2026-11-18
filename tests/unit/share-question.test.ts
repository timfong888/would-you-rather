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
