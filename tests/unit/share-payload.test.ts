// Regression for #154: the iMessage share had the Vercel project domain, the URL twice and no preview card.
// Covers the whole payload each surface hands to the OS share sheet, plus a source guard against the old host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { shareLink, buildShareLink } from '../../lib/shareQuestion';
import { SHARE_PROMPT } from '../../lib/shareInvite';
import { CANONICAL_ORIGIN } from '../../lib/site';
import { SITE_URL } from '../../constants/config';

const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const LINK_ID = '22d44622-885e-4a9e-ab74-0346c9bac448';
const text = SHARE_PROMPT;
const link = buildShareLink({ origin: SITE_URL, questionId: 'hl-5', linkId: LINK_ID, generation: 1, kids: false, friendPick: 'A' });

test('share link for hl-5 is on the canonical host', () => {
  assert.ok(link.startsWith(`${CANONICAL_ORIGIN}/p/hl-5?link_id=${LINK_ID}&gen=1&f=`), link);
  assert.ok(!link.includes('vercel.app'));
});

test('iOS app: the sheet gets the URL exactly once (message has none)', async () => {
  let seen: any;
  await shareLink({ title: 'WYR', text, url: link, os: 'ios', nativeShare: (o) => { seen = o; } });
  assert.equal(seen.url, link);
  assert.equal(count(seen.message, 'http'), 0);
  assert.equal(count(`${seen.message}\n${seen.url}`, link), 1);
});

test('Android app: the URL is in the message once and no url field', async () => {
  let seen: any;
  await shareLink({ title: 'WYR', text, url: link, os: 'android', nativeShare: (o) => { seen = o; } });
  assert.equal(seen.url, undefined);
  assert.equal(count(seen.message, link), 1);
});

test('web Share API: url is separate from text, text has no URL', async () => {
  let seen: any;
  await shareLink({ title: 'WYR', text, url: link, nav: { share: async (d) => { seen = d; } } });
  assert.equal(seen.url, link);
  assert.equal(count(seen.text, 'http'), 0);
});

test('kids share link carries no link_id or gen', () => {
  const kids = buildShareLink({ origin: SITE_URL, questionId: 'kf-2', linkId: '', generation: 1, kids: true, friendPick: null });
  assert.equal(kids, `${CANONICAL_ORIGIN}/p/kf-2`);
});

test('no app source hard-codes a vercel.app host', () => {
  const root = join(__dirname, '../..');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(name) && readFileSync(full, 'utf8').includes('vercel.app')) hits.push(full.replace(root + '/', ''));
    }
  };
  for (const d of ['app', 'components', 'constants', 'lib', 'api', 'contexts', 'hooks']) walk(join(root, d));
  assert.deepEqual(hits, []);
});
