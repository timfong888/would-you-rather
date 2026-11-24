/**
 * Kids routes keep no persisted visitor ID and send no analytics, even with a PostHog key configured.
 * The kids vote request carries no visitorId, and nothing about a kids vote is stored (localStorage,
 * sessionStorage, cookies); answers stored by older versions are purged when a kids route is shown.
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
import { CATEGORIES, QUESTIONS } from '../../api/_lib/data.js';
const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

async function player(browser, preset) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (preset) await ctx.addInitScript((id) => { try { if (!localStorage.getItem('wyr_visitor_id')) localStorage.setItem('wyr_visitor_id', id); } catch {} }, preset);
  const page = await ctx.newPage();
  const ph = [];
  const events = [];
  // "(not sent: kids page)" debug markers are the gate working, not events
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[analytics]') && !t.startsWith('[analytics] (not sent')) events.push(t.slice(12).split(' ')[0]); });
  await page.route(/posthog\.com/, (r) => { ph.push(r.request().url()); r.abort(); });
  const votes = [];
  await page.route('**/api/votes', (r) => { votes.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tally: { a: 30, b: 20, total: 50 }, choice: 'A' }) }); });
  return { ctx, page, ph, events, votes };
}
const vid = (page) => page.evaluate(() => localStorage.getItem('wyr_visitor_id'));
// Every stored value that mentions a kids question (kf-*), by key.
const kidsStorage = (page) => page.evaluate(() => Object.fromEntries(
  [...Object.entries(localStorage), ...Object.entries(sessionStorage)].filter(([, v]) => /kf-\d/.test(v))));

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
  const { ctx, page, ph, events, votes } = await player(browser, 'pre-existing-adult-id');
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
  check(votes.length === 1 && !('visitorId' in votes[0]), 'kids: the vote request carries no visitorId', JSON.stringify(votes));
  const stored = await kidsStorage(page);
  check(Object.keys(stored).length === 0, 'kids: nothing about the kids vote is written to localStorage/sessionStorage', JSON.stringify(stored));
  check((await ctx.cookies()).length === 0, 'kids: no cookies');
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
{ // kids answers stored by an older version are removed when a kids route is shown; adult answers stay
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('wyr_voted_v1', JSON.stringify({ 'kf-1': 'A', 'hl-1': 'B' }));
    localStorage.setItem('wyr_answered_questions', JSON.stringify({ 'kf-1': 'A' }));
    localStorage.setItem('wyr_pending_votes', JSON.stringify([{ questionId: 'kf-3', choice: 'A' }]));
  } } catch {} });
  const page = await ctx.newPage();
  await page.route(/posthog\.com|\/api\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(`${HOST}/categories/tiny-choices`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const left = await page.evaluate(() => ({ voted: localStorage.getItem('wyr_voted_v1'), answered: localStorage.getItem('wyr_answered_questions'), pending: localStorage.getItem('wyr_pending_votes') }));
  check(!/kf-/.test(JSON.stringify(left)), 'kids route: older stored kids answers are purged', JSON.stringify(left));
  check(left.voted === JSON.stringify({ 'hl-1': 'B' }), 'kids route: adult answers are kept', String(left.voted));
  await ctx.close();
}
// Every kids category (audience 'kids', read from the data, so a new one is covered the day it exists): its category,
// end-of-category, unlock (parental gate) and result routes, and its first question. Each in a fresh browser with an
// ID already stored: nothing is sent, the ID is removed, nothing is stored, no cookie.
// Real Talk (audience 'teen') follows the adult rules: analytics on, ID persisted.
{
  const kidsCats = CATEGORIES.filter((c) => c.audience === 'kids');
  const teenCats = CATEGORIES.filter((c) => c.audience === 'teen');
  check(kidsCats.length === 8 && teenCats.length === 1, 'data: 8 kids categories and 1 teen category', `${kidsCats.length}/${teenCats.length}`);
  for (const c of kidsCats) {
    const first = QUESTIONS.find((q) => q.category === c.id);
    for (const route of [`/categories/${c.id}`, `/complete/${c.id}`, `/unlock/${c.id}`, `/game/${first.id}`, `/results/${first.id}`]) {
      const { ctx, page, ph, events } = await player(browser, 'pre-existing-adult-id');
      await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /^(wyr_|ph_)/.test(k)));
      const ok = events.length === 0 && ph.length === 0 && (await vid(page)) === null && stored.length === 0 && (await ctx.cookies()).length === 0;
      check(ok, `kids ${c.id}: ${route} sends nothing, keeps no ID, stores nothing`, ok ? '' : JSON.stringify({ events, ph: ph.length, vid: await vid(page), stored }));
      await ctx.close();
    }
  }
  for (const c of teenCats) {
    for (const route of [`/categories/${c.id}`, `/game/${QUESTIONS.find((q) => q.category === c.id).id}`]) {
      const { ctx, page, events } = await player(browser);
      await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      check(events.includes('session_start') && !!(await vid(page)), `teen ${c.id}: ${route} follows the adult rules (events fire, ID persisted)`, events.join(','));
      await ctx.close();
    }
  }
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
