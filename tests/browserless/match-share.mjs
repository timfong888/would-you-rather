/**
 * Match share (#92) browser check. Run against a built site:
 *   APP_HOST=http://localhost:4175 node tests/browserless/match-share.mjs
 * Build with EXPO_PUBLIC_SITE_URL=http://localhost:4175 (share links use SITE_URL, so without it recipient B
 * is sent to the production domain), then `npm run build:web`.
 * (needs `playwright`; the vote and tally endpoints are mocked, nothing is voted for real.)
 *
 * Adult: A shares after answering; B opens the link, answers, and sees matched/different;
 *        B taps "Send one back"; A opens that link and sees the result.
 * Kids:  the same flow on /game/kf-2. The match flow itself (open link, result, "Send one back",
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

const clipFull = (page) => page.evaluate(() => navigator.clipboard.readText());
// The copied text is `message\nlink` for match actions; the link is the last line.
const clip = async (page) => (await clipFull(page)).trim().split('\n').pop();
async function vote(page, optionText) {
  await page.getByText(optionText, { exact: false }).first().click();
  // The sender confirms; a recipient (arrived via a share link) answers on the first tap (#134), so no Confirm exists.
  await page.getByText(/confirm/i).first().click({ timeout: 2000 }).catch(() => {});
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

    await B.page.getByTestId('send-back').click(); // "Send one back" (was "Tell them" before #136)
    await B.page.waitForTimeout(400);
    const replyUrl = await clip(B.page);
    check(new URL(replyUrl).searchParams.get('f') !== null, `B(${outcome}): "Send one back" link carries B's pick`, replyUrl);
    const tellText = await clipFull(B.page);
    check(tellText.trim().split('\n').length >= 2 && /^(Plot twist|We picked differently|I picked an answer)/.test(tellText), `B(${outcome}): "Send one back" copies the message with the link`, JSON.stringify(tellText.slice(0, 60)));
    const askBtn = B.page.getByRole('button', { name: 'Ask them another' });
    if (await askBtn.count()) {
      await askBtn.click();
      await B.page.waitForTimeout(400);
      const another = await clip(B.page);
      const af = new URL(another).searchParams.get('f');
      check(!!af && af.length === 3 && af !== new URL(replyUrl).searchParams.get('f'), `B(${outcome}): "Ask them another" link is a before-answering share`, another);
    }
    const after = await B.page.evaluate(() => window.__writes.length);
    check(after === before, `B(${outcome}): match actions wrote nothing to storage/cookies`, `${before}->${after}`);
    const extra = logB.slice(reqsBefore).filter((u) => u.startsWith(HOST) ? /\/api\//.test(u) : /posthog|analytics|\/e\/|\/batch/.test(u));
    check(extra.length === 0, `B(${outcome}): match actions made no network request`, extra.join(' '));

    if (outcome === 'different') {
      // A opens B's reply link. Adult: A's vote is remembered on this device, so the result shows
      // immediately. Kids: nothing about A's vote was stored (COPPA), so A answers again first.
      await A.page.goto(replyUrl, { waitUntil: 'load' });
      await A.page.waitForURL(/\/game\//);
      await A.page.waitForLoadState('networkidle');
      await A.page.waitForTimeout(800);
      const c2 = A.page.locator('[data-testid=match-card]');
      if (kids) {
        check((await c2.count()) === 0, 'A (kids): no stored answer, so no result before answering again');
        await vote(A.page, optA);
      }
      check((await c2.count()) === 1 && /picked differently/.test(await c2.innerText()), 'A: opening the reply link shows the result (A=A vs B=B)');
    }
    await B.ctx.close();
  }

  // Before answering: A picks but does not confirm, shares; B answers and replies; A answers and sees the result.
  {
    const logC = [];
    const A2 = await newPlayer(browser, logC);
    await A2.page.goto(`${HOST}/game/${id}`, { waitUntil: 'networkidle' });
    await A2.page.getByText(optA, { exact: false }).first().click();
    await A2.page.getByText(/Challenge a friend/i).first().click();
    await A2.page.waitForTimeout(400);
    const preUrl = await clip(A2.page);
    const pf = new URL(preUrl).searchParams.get('f');
    check(!!pf && pf.length === 3, 'before-answering: link carries an "ask" code', preUrl);
    const B2 = await newPlayer(browser, logC);
    await B2.page.goto(preUrl, { waitUntil: 'load' });
    await B2.page.waitForURL(/\/game\//);
    await B2.page.waitForLoadState('networkidle');
    await vote(B2.page, optB);
    const asked = B2.page.locator('[data-testid=match-card]');
    check((await asked.count()) === 1 && /You picked one/.test(await asked.innerText()), 'before-answering: B sees "You picked one" (no comparison)');
    check((await B2.page.getByTestId('send-back').count()) === 1, 'before-answering: B has a "Send one back" button');
    await B2.page.getByTestId('send-back').click();
    await B2.page.waitForTimeout(400);
    const replyFull = await clipFull(B2.page);
    const reply = replyFull.trim().split('\n').pop();
    check(replyFull.trim().split('\n').length >= 2 && new URL(reply).searchParams.get('f') !== pf, 'before-answering: "Send one back" copies message + a link carrying B\'s pick', reply);
    await A2.page.goto(reply, { waitUntil: 'load' });
    await A2.page.waitForURL(/\/game\//);
    await A2.page.waitForLoadState('networkidle');
    await vote(A2.page, optA);
    const res = A2.page.locator('[data-testid=match-card]');
    check((await res.count()) === 1 && /picked differently/.test(await res.innerText()), 'before-answering: A answers and sees the result (A vs B)');
    if (kids) {
      const bad = logC.filter((u) => /posthog|\/e\/|\/batch|analytics/i.test(u));
      check(bad.length === 0, 'kids before-answering: no analytics request', bad.join(' '));
    }
    await A2.ctx.close(); await B2.ctx.close();
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
