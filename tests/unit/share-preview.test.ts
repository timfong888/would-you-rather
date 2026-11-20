// Share links: one URL, the canonical domain, and a static OG preview (#122).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { nativeShareOptions, shareLink, buildShareLink } from '../../lib/shareQuestion';
import { CANONICAL_ORIGIN } from '../../lib/site';
import { sharePageMeta } from '../../lib/sharePage';
// @ts-ignore plain JS
import og from '../../api/og.js';
// @ts-ignore plain JS
import { QUESTIONS } from '../../api/_lib/data.js';

const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const url = `${CANONICAL_ORIGIN}/p/kf-14?f=3md`;
const text = 'I picked an answer. Which would you pick?\nShrink to the size of an ant for a day — OR — Grow as tall as a giraffe for a day';

test('canonical origin is the real domain, not the Vercel project domain', () => {
  assert.equal(CANONICAL_ORIGIN, 'https://www.wouldyourather.fyi');
  const link = buildShareLink({ origin: CANONICAL_ORIGIN, questionId: 'kf-14', linkId: '', generation: 1, kids: true, friendPick: null });
  assert.equal(link, 'https://www.wouldyourather.fyi/p/kf-14');
  assert.ok(!link.includes('vercel.app'));
});

test('iOS: the URL is only in `url`, never repeated in the message', () => {
  const o = nativeShareOptions({ title: 'WYR', text, url, os: 'ios' });
  assert.equal(o.url, url);
  assert.equal(o.message, text);
  assert.equal(count(`${o.message}\n${o.url}`, url), 1);
});

test('Android ignores `url`, so the link is in the message exactly once', () => {
  const o = nativeShareOptions({ title: 'WYR', text, url, os: 'android' });
  assert.equal(o.url, undefined);
  assert.equal(count(o.message, url), 1);
});

test('shareLink on native hands Share.share a single URL', async () => {
  let seen: any;
  await shareLink({ title: 'WYR', text, url, os: 'ios', nativeShare: (o) => { seen = o; } });
  assert.equal(count(JSON.stringify(seen), url), 1);
});

for (const id of ['kf-14', 'hl-1']) {
  test(`share page meta for ${id}: question title, canonical og:url and static og:image`, () => {
    const q = QUESTIONS.find((x: any) => x.id === id)!;
    const m = sharePageMeta(q, CANONICAL_ORIGIN);
    assert.ok(m.title.includes(q.optionA.slice(0, 20)));
    assert.equal(m.url, `${CANONICAL_ORIGIN}/p/${id}`);
    assert.equal(m.image, `${CANONICAL_ORIGIN}/api/og?id=${id}`);
    assert.equal(m.siteName, 'Would You Rather?');
    assert.equal([m.imageWidth, m.imageHeight].join('x'), '1200x630');
  });
}

before(() => {
  // Keep the test offline: the OG function fetches the logo from its own origin and @vercel/og fetches emoji art.
  const real = globalThis.fetch;
  globalThis.fetch = ((u: any, init?: any) =>
    String(u).includes('apple-touch-icon') ? Promise.resolve(new Response(null, { status: 404 }))
    : String(u).includes('jsdelivr') ? Promise.resolve(new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', { headers: { 'content-type': 'image/svg+xml' } }))
    : real(u, init)) as typeof fetch;
});

for (const q of ['id=kf-14', 'id=hl-1', '']) {
  test(`GET /api/og?${q} is a 1200x630 PNG with no cookies`, async () => {
    const res = await og(new Request(`https://x.test/api/og?${q}`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('set-cookie'), null);
    const b = new Uint8Array(await res.arrayBuffer());
    assert.equal(String.fromCharCode(...b.slice(1, 4)), 'PNG');
    const dv = new DataView(b.buffer, b.byteOffset);
    assert.equal(dv.getUint32(16), 1200);
    assert.equal(dv.getUint32(20), 630);
  });
}

test('GET /api/og for an unknown question is a 404', async () => {
  assert.equal((await og(new Request('https://x.test/api/og?id=nope'))).status, 404);
});
