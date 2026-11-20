/**
 * #85 network proof. Run against a build made WITH a (fake) PostHog key:
 *   EXPO_PUBLIC_POSTHOG_KEY=phc_fakekeyfortest0000000000000000000000000 npx expo export -p web --clear
 *   node <static server for dist> ; APP_HOST=http://localhost:4175 node tests/browserless/analytics-network.mjs
 * (Metro caches inlined env vars: always --clear after changing EXPO_PUBLIC_*.)
 * PostHog's host is intercepted and answered, so nothing leaves the machine; what the page tried to
 * send is what we assert on.
 *   1. An adult event reaches PostHog's ingest endpoint (/batch) with page_view, session_start and
 *      question_answered. This is what failed before: the web client threw "No storage available".
 *   2. Kids routes (hard load): zero PostHog requests, no analytics keys left in storage.
 *   3. In-app adult -> kids navigation: zero PostHog requests after the click, no new distinct id,
 *      no kids path anywhere in what was sent.
 */
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const ph = [];
  await page.route(/posthog\.com/, async (route) => {
    const req = route.request();
    let body = '';
    try {
      const buf = req.postDataBuffer();
      body = buf ? (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf).toString() : buf.toString()) : '';
    } catch { body = ''; }
    ph.push({ url: req.url(), body, t: Date.now() });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"status":1,"featureFlags":{},"flags":{}}' });
  });
  await page.route('**/api/votes', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tally: { a: 30, b: 20, total: 50 }, choice: 'A' }) }));
  await page.route('**/api/tallies**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, page, ph };
}
const events = (ph) => ph.filter((r) => /\/batch|\/e\/|\/capture/.test(r.url)).flatMap((r) => {
  try { const j = JSON.parse(r.body); return j.batch ?? (Array.isArray(j) ? j : [j]); } catch { return []; }
});

const b = await chromium.launch();

// 1. adult hard load + vote
{
  const { ctx, page, ph } = await newPage(b);
  await page.goto(`${HOST}/game/sb-1`, { waitUntil: 'networkidle' });
  await page.getByText(/./).first().waitFor();
  await page.locator('text=/option|would/i').first().waitFor().catch(() => {});
  const optA = await page.evaluate(() => document.body.innerText);
  await page.waitForTimeout(1500);
  const clickable = page.locator('[role=button], div[tabindex="0"]').first();
  await page.evaluate(() => {});
  // vote: first option then CONFIRM
  const first = page.getByText(/Loudly trip and fall/i).first();
  if (await first.count()) await first.click();
  await page.getByText(/confirm/i).first().click().catch(() => {});
  // PostHog batches events (flush interval 10s): wait for the flush.
  await page.waitForTimeout(12500);
  const evs = events(ph);
  const names = evs.map((e) => e.event);
  check(ph.some((r) => /\/batch/.test(r.url)), 'adult: PostHog ingest (/batch) received a request', `${ph.length} requests`);
  check(names.includes('page_view'), 'adult: page_view delivered', names.join(','));
  check(names.includes('session_start'), 'adult: session_start delivered');
  check(names.includes('question_answered'), 'adult: question_answered delivered');
  const ids = new Set(evs.map((e) => e.distinct_id || e.properties?.distinct_id).filter(Boolean));
  const stored = await page.evaluate(() => localStorage.getItem('wyr_visitor_id'));
  check(!!stored && ids.size === 1 && [...ids][0] === stored, 'adult: events carry the persisted visitor id', `${[...ids].join(',')}`);
  await ctx.close();
}

// 2. kids hard loads
for (const path of ['/game/kf-2', '/categories/kids-family', '/results/kf-2', '/complete/kids-family', '/unlock/kids-family', '/would-you-rather-questions-for-kids']) {
  const { ctx, page, ph } = await newPage(b);
  await ctx.addInitScript(() => { try { localStorage.setItem('wyr_visitor_id', 'seed'); localStorage.setItem('wyr_first_touch', '{}'); localStorage.setItem('wyr_activation', '{}'); localStorage.setItem('ph_phc_seed_posthog', '{}'); } catch {} });
  await page.goto(`${HOST}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(12500);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^(wyr_visitor_id|wyr_first_touch|wyr_activation|ph_)/.test(k)));
  check(ph.length === 0, `kids ${path}: zero PostHog requests`, ph.map((r) => r.url).join(' '));
  check(keys.length === 0, `kids ${path}: no analytics keys in storage`, keys.join(','));
  await ctx.close();
}

// 3. in-app adult -> kids
{
  const { ctx, page, ph } = await newPage(b);
  await page.goto(`${HOST}/categories`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(12500); // let the adult events flush before the click
  const idBefore = await page.evaluate(() => localStorage.getItem('wyr_visitor_id'));
  const beforeCount = ph.length;
  const evBefore = events(ph).length;
  await page.getByText(/Kids\s*&\s*Family/i).first().click();
  await page.waitForURL(/kids-family/);
  await page.waitForTimeout(12500); // longer than a flush interval: anything queued would have been sent
  const sentAfter = ph.slice(beforeCount);
  const idAfter = await page.evaluate(() => localStorage.getItem('wyr_visitor_id'));
  check(!!idBefore, 'adult -> kids: an adult id existed before the click');
  check(sentAfter.length === 0, 'adult -> kids: zero PostHog requests after the click', sentAfter.map((r) => r.url + ' ' + r.body.slice(0, 80)).join(' | '));
  check(!JSON.stringify(ph.map((r) => r.body)).match(/kids-family|kf-/), 'adult -> kids: no kids path in anything sent');
  check(idAfter === null, 'adult -> kids: the stored visitor id is gone and no new one was created');
  check(events(ph).length === evBefore, 'adult -> kids: no new events');
  await ctx.close();
}

// 4. in-app kids -> Settings with a campaign on the kids URL (Vercel Security Review on #85, a776c7d)
{
  const { ctx, page, ph } = await newPage(b);
  await page.goto(`${HOST}/game/kf-2?utm_campaign=kidscampaign&utm_source=kidsnews&link_id=kidslink&gen=3`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  check(ph.length === 0, 'kids -> settings: nothing sent while on the kids route');
  await page.getByText('⚙️').first().click();
  await page.waitForURL(/settings/);
  await page.waitForTimeout(12500);
  const bodies = JSON.stringify(ph.map((r) => r.body));
  check(!/kf-|kids|kidscampaign|kidsnews|kidslink/.test(bodies), 'kids -> settings: no kids path, campaign or link id in anything sent', (bodies.match(/kf-\S{0,12}|kids\w*/) || [''])[0]);
  const names = events(ph).map((e) => e.event);
  console.log('      events after settings:', names.join(',') || '(none)');
  await ctx.close();
}

await b.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
