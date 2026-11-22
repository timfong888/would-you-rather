// /api/card renders a real PNG for both ratios and the "my take" variant, and
// 404s for an unknown question. Guards #73: the file must stay a plain `.js`
// function (Vercel did not build the old `.jsx`) and every wrapper div needs
// `display: flex` (satori throws otherwise, which only shows up when rendered).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS
import card from '../../api/card.js';

before(() => {
  process.env.WYR_VOTE_STORE = 'memory';
  delete process.env.DATABASE_URL;
  // @vercel/og fetches emoji artwork from a CDN; keep the test offline.
  const real = globalThis.fetch;
  globalThis.fetch = ((url: any, init?: any) =>
    String(url).includes('jsdelivr')
      ? Promise.resolve(new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', { headers: { 'content-type': 'image/svg+xml' } }))
      : real(url, init)) as typeof fetch;
});

for (const query of ['ratio=1.91x1', 'ratio=9x16', 'ratio=9x16&voted=A', 'ratio=1.91x1&voted=B']) {
  test(`GET /api/card?id=hl-1&${query} returns a PNG`, async () => {
    const res = await card(new Request(`https://x.test/api/card?id=hl-1&${query}`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.equal(String.fromCharCode(...bytes.slice(1, 4)), 'PNG');
  });
}

test('GET /api/card for an unknown question is a 404', async () => {
  const res = await card(new Request('https://x.test/api/card?id=nope'));
  assert.equal(res.status, 404);
});

// #188: the card never shows anyone's pick, so a `voted` parameter must not change the image.
for (const ratio of ['1.91x1', '9x16']) {
  test(`GET /api/card ignores voted (${ratio}): same image as without it`, async () => {
    const render = async (q: string) => Buffer.from(await (await card(new Request(`https://x.test/api/card?id=hl-1&ratio=${ratio}${q}`))).arrayBuffer());
    const plain = await render('');
    assert.ok(plain.equals(await render('&voted=A')), 'voted=A changed the card');
    assert.ok(plain.equals(await render('&voted=B')), 'voted=B changed the card');
  });
}
