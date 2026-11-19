/**
 * Kids routes keep no persisted visitor ID and send no analytics, even with a PostHog key configured.
 * Build with a (fake) key and analytics debug logging so the analytics path is live, serve it, then run
 * (use `npx expo export -p web --clear` if Metro served a stale env):
 *   EXPO_PUBLIC_ANALYTICS_DEBUG=true EXPO_PUBLIC_POSTHOG_DEBUG_KEY=phc_test EXPO_PUBLIC_POSTHOG_KEY=phc_test \
 *     EXPO_PUBLIC_SITE_URL=http://localhost:4175 npm run build:web
 *   APP_HOST=http://localhost:4175 node tests/browserless/kids-no-tracking.mjs
 * The debug build logs every event that reaches track() as "[analytics] <event>", before the client is used,
 * so it shows exactly what would be sent. PostHog requests are also blocked and recorded; nothing leaves the machine.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

async function player(browser, preset) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (preset) await ctx.addInitScript((id) => { try { if (!localStorage.getItem('wyr_visitor_id')) localStorage.setItem('wyr_visitor_id', id); } catch {} }, preset);
  const page = await ctx.newPage();
  const ph = [];
  const events = [];
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[analytics]')) events.push(t.slice(12).split(' ')[0]); });
  await page.route(/posthog\.com/, (r) => { ph.push(r.request().url()); r.abort(); });
  await page.route('**/api/votes', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tally: { a: 30, b: 20, total: 50 }, choice: 'A' }) }));
  return { ctx, page, ph, events };
}
const vid = (page) => page.evaluate(() => localStorage.getItem('wyr_visitor_id'));

const browser = await chromium.launch();
{ // adult: the key is live, so analytics goes out and the ID is persisted
  const { ctx, page, events } = await player(browser);
  await page.goto(`${HOST}/game/sb-1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check(!!(await vid(page)), 'adult: visitor ID is persisted');
  check(events.includes('session_start'), 'adult: events reach track() (debug build), so the kids checks below mean something', events.join(','));
  await ctx.close();
}
{ // kids landing with a pre-existing stored ID: it is removed, nothing sent, nothing re-created
  const { ctx, page, ph, events } = await player(browser, 'pre-existing-adult-id');
  await page.goto(`${HOST}/game/kf-2`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check((await vid(page)) === null, 'kids landing: an existing wyr_visitor_id is removed and none is created');
  await page.getByText('Live in a treehouse', { exact: false }).first().click();
  await page.getByText(/confirm/i).first().click();
  await page.waitForTimeout(1200);
  await page.getByText(/Send this question to a friend/i).first().click().catch(() => {});
  await page.waitForTimeout(800);
  check((await vid(page)) === null, 'kids: still no wyr_visitor_id after voting and sharing');
  check(events.length === 0, 'kids: no analytics event reaches track() on load, vote or share', events.join(','));
  check(ph.length === 0, 'kids: no analytics request on load, vote or share', ph.join(' '));
  await ctx.close();
}
{ // adult first, then into a kids route inside the app: the ID is purged and nothing more is sent
  const { ctx, page, ph } = await player(browser);
  await page.goto(`${HOST}/game/sb-1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(!!(await vid(page)), 'adult then kids: ID exists on the adult page');
  const before = ph.length;
  await page.evaluate(() => { window.history.pushState({}, '', '/game/kf-2'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await page.waitForTimeout(1500);
  check((await vid(page)) === null, 'adult then kids: the ID is removed when the kids route is shown');
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
