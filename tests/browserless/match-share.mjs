/**
 * Match share (#92) browser check. Run against a built site:
 *   APP_HOST=http://localhost:4175 node tests/browserless/match-share.mjs
 * (needs `playwright`; the vote and tally endpoints are mocked, nothing is voted for real.)
 *
 * Adult: A shares after answering; B opens the link, answers, and sees matched/different;
 *        B taps "Tell them"; A opens that link and sees the result.
 * Kids:  the same flow on /game/kf-2. The match flow itself (open link, result, "Tell them",
 *        "Ask them another") must make no request other than vote/tally, send no analytics, and
 *        write nothing to localStorage/sessionStorage/cookies after the vote.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

async function newPlayer(browser, log) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => {
    try { delete Navigator.prototype.share; } catch {}
    window.__writes = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { window.__writes.push(['set', k]); return set.call(this, k, v); };
    const rm = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) { window.__writes.push(['rm', k]); return rm.call(this, k); };
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', { get() { return desc.get.call(this); }, set(v) { window.__writes.push(['cookie', String(v).split('=')[0]]); desc.set.call(this, v); } });
  });
  const page = await ctx.newPage();
  page.on('request', (r) => log.push(r.url()));
  await page.route('**/api/votes', (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tally: { a: 30, b: 20, total: 50 }, choice: body.choice }) });
  });
  await page.route('**/api/tallies**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, page };
}

const clip = (page) => page.evaluate(() => navigator.clipboard.readText());
async function vote(page, optionText) {
  await page.getByText(optionText, { exact: false }).first().click();
  await page.getByText(/confirm/i).first().click();
  await page.waitForTimeout(700);
}

async function scenario(browser, { name, id, optA, optB, kids }) {
  console.log(`\n== ${name} (${id}) ==`);
  const logA = [], logB = [];
  const A = await newPlayer(browser, logA);
  await A.page.goto(`${HOST}/game/${id}`, { waitUntil: 'networkidle' });
  await vote(A.page, optA);                                   // A picks A
  await A.page.getByText(/Send this question to a friend/i).first().click();
  const shareUrl = await clip(A.page);
  const f = new URL(shareUrl).searchParams.get('f');
  check(!!f && f.length === 3, 'A: the shared link carries a 3-char pick code', shareUrl);
  check(!shareUrl.includes('=A') && !/[?&]f=[AB]$/.test(shareUrl), 'A: the code does not spell the pick');
  if (kids) check(!/link_id|gen=/.test(shareUrl), 'A: kids link has no link_id/gen');

  for (const [pickText, outcome] of [[optA, 'matched'], [optB, 'different']]) {
    const B = await newPlayer(browser, logB);
    await B.page.goto(shareUrl, { waitUntil: 'load' });          // goes through the /p/<id> share page
    await B.page.waitForURL(/\/game\//);
    await B.page.waitForLoadState('networkidle');
    check(new URL(B.page.url()).searchParams.get('f') === f, `B(${outcome}): f survives the /p redirect`);
    check((await B.page.locator('[data-testid=match-card]').count()) === 0, `B(${outcome}): no result before answering`);
    await vote(B.page, pickText);
    const card = B.page.locator('[data-testid=match-card]');
    check((await card.count()) === 1, `B(${outcome}): result card shows after answering`);
    const text = await card.innerText();
    check(outcome === 'matched' ? /You matched/.test(text) : /picked differently/.test(text), `B(${outcome}): heading`, JSON.stringify(text.split('\n').slice(0, 2)));
    const before = await B.page.evaluate(() => window.__writes.length);
    const reqsBefore = logB.length;

    await B.page.getByRole('button', { name: 'Tell them' }).click();
    await B.page.waitForTimeout(400);
    const replyUrl = await clip(B.page);
    check(new URL(replyUrl).searchParams.get('f') !== null, `B(${outcome}): "Tell them" link carries B's pick`, replyUrl);
    const askBtn = B.page.getByRole('button', { name: 'Ask them another' });
    if (await askBtn.count()) {
      await askBtn.click();
      await B.page.waitForTimeout(400);
      const another = await clip(B.page);
      check(!/[?&]f=/.test(another), `B(${outcome}): "Ask them another" link has no pick`, another);
    }
    const after = await B.page.evaluate(() => window.__writes.length);
    check(after === before, `B(${outcome}): match actions wrote nothing to storage/cookies`, `${before}->${after}`);
    const extra = logB.slice(reqsBefore).filter((u) => u.startsWith(HOST) ? /\/api\//.test(u) : /posthog|analytics|\/e\/|\/batch/.test(u));
    check(extra.length === 0, `B(${outcome}): match actions made no network request`, extra.join(' '));

    if (outcome === 'different') {
      // A opens B's reply link; A already voted on this device, so the result shows immediately.
      await A.page.goto(replyUrl, { waitUntil: 'load' });
      await A.page.waitForURL(/\/game\//);
      await A.page.waitForLoadState('networkidle');
      await A.page.waitForTimeout(800);
      const c2 = A.page.locator('[data-testid=match-card]');
      check((await c2.count()) === 1 && /picked differently/.test(await c2.innerText()), 'A: opening the reply link shows the result (A=A vs B=B)');
    }
    await B.ctx.close();
  }

  if (kids) {
    const bad = [...logA, ...logB].filter((u) => /posthog|\/e\/|\/batch|googletagmanager|analytics/i.test(u));
    check(bad.length === 0, 'kids: no analytics request anywhere in the flow', bad.join(' '));
    const hosts = new Set([...logA, ...logB].map((u) => new URL(u).host));
    check([...hosts].every((h) => h === new URL(HOST).host), 'kids: every request went to the app host only', [...hosts].join(','));
  }
  await A.ctx.close();
}

const browser = await chromium.launch();
await scenario(browser, { name: 'Adult', id: 'sb-1', optA: 'Loudly trip and fall', optB: 'Accidentally call your teacher', kids: false });
await scenario(browser, { name: 'Kids & Family', id: 'kf-2', optA: 'Live in a treehouse', optB: 'Live in a castle', kids: true });
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
