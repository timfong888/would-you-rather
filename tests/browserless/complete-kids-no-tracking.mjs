/**
 * End-of-category screen (#81) vs the kids gate (#85): /complete/kids-family sends nothing.
 * No event reaches track() (category_completed included), no PostHog request, no wyr_ or ph_ keys,
 * and kids players get no "NEXT" button into an adult pack. The adult screen still fires category_completed.
 * Build as in kids-no-tracking.mjs (debug build, fake key, EXPO_PUBLIC_SITE_URL=http://localhost:4175), serve, then:
 *   APP_HOST=http://localhost:4175 node tests/browserless/complete-kids-no-tracking.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

const browser = await chromium.launch();
async function screen(path) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ph = [], events = [];
  await page.route(/posthog\.com/, (r) => { ph.push(r.request().url()); r.abort(); });
  // "(not sent: kids page)" debug markers are the gate working, not events
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[analytics]') && !t.startsWith('[analytics] (not sent')) events.push(t.slice(12).split(' ')[0]); });
  await page.goto(`${HOST}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const next = await page.getByText(/^NEXT:/).count();
  const rendered = await page.getByText(/finished/i).count();
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /^(wyr_|ph_)/.test(k)));
  await ctx.close();
  return { ph, events, next, keys, rendered };
}

const kids = await screen('/complete/kids-family');
check(kids.rendered > 0, 'kids end screen: the screen rendered ("You\'ve finished …")');
check(kids.ph.length === 0, 'kids end screen: no PostHog request', kids.ph.join(','));
check(kids.events.length === 0, 'kids end screen: no event reaches track() (category_completed included)', kids.events.join(','));
check(kids.keys.length === 0, 'kids end screen: no wyr_ or ph_ keys stored', kids.keys.join(','));
check(kids.next === 0, 'kids end screen: no NEXT button into an adult pack');

const adult = await screen('/complete/high-life');
check(adult.events.includes('category_completed'), 'adult end screen: category_completed fires', adult.events.join(','));

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`);
process.exit(ok === results.length ? 0 : 1);
