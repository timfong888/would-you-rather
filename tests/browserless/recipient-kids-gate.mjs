/**
 * Recipient landing (#134) vs the kids gate (#85): someone who opens a shared link and answers.
 * Kids item: no PostHog request, no event reaches track(), no wyr_ or ph_ keys.
 * Adult item: the recipient funnel events fire (shared_link_opened, shared_link_answered, ...).
 * Build as in kids-no-tracking.mjs (debug build, fake key, EXPO_PUBLIC_SITE_URL=http://localhost:4175), serve, then:
 *   APP_HOST=http://localhost:4175 node tests/browserless/recipient-kids-gate.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HOST = process.env.APP_HOST || 'http://localhost:4175';
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

const browser = await chromium.launch();
async function recipient(path, optionText) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ph = [], events = [];
  await page.route(/posthog\.com/, (r) => { ph.push(r.request().url()); r.abort(); });
  // "(not sent: kids page)" debug markers are the gate working, not events
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[analytics]') && !t.startsWith('[analytics] (not sent')) events.push(t.slice(12).split(' ')[0]); });
  await page.goto(`${HOST}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByText(optionText, { exact: false }).first().click(); // recipients answer on the first tap
  await page.waitForTimeout(1200);
  await page.getByText(/PLAY ANOTHER|Send one back|Get the app/i).first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(800);
  const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /^(wyr_|ph_)/.test(k)));
  await ctx.close();
  return { ph, events, keys };
}

const kids = await recipient('/game/kf-2?f=7kf', 'Live in a treehouse');
check(kids.ph.length === 0, 'kids recipient: no PostHog request', kids.ph.join(','));
check(kids.events.length === 0, 'kids recipient: no event reaches track()', kids.events.join(','));
check(kids.keys.length === 0, 'kids recipient: no wyr_*/ph_* keys stored', kids.keys.join(','));

const adult = await recipient('/game/sb-1?link_id=3bdd8a70-6caa-4f2f-b4ff-6c277a0a301c&gen=1&f=3zn', 'Loudly trip and fall');
for (const name of ['shared_link_opened', 'shared_link_answered']) check(adult.events.includes(name), `adult recipient: ${name} fires`);
check(adult.keys.includes('wyr_visitor_id'), 'adult recipient: analytics unchanged (visitor ID persisted)');

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`);
process.exit(ok === results.length ? 0 : 1);
