/**
 * #96: the mixed /feed must show no Kids & Family questions.
 *   APP_HOST=http://localhost:4175 node tests/browserless/feed-no-kids.mjs
 * Checks every tab (FOR YOU / TRENDING / NEW) and the category chips, using the kids question
 * texts from constants/kidsQuestions.ts, plus that an adult route still persists wyr_visitor_id.
 * Tallies are mocked; nothing is voted.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HOST = process.env.APP_HOST || 'http://localhost:4175';
// Option A of every kids (kf-) and teen (tn-) question: free(n, category, tag, 'A', 'B') / paid(...) and the teen free(n, 'A', 'B').
import { CATEGORIES } from '../../api/_lib/data.js';
const read = (f) => fs.readFileSync(new URL(`../../constants/${f}`, import.meta.url), 'utf8');
const kidsTexts = [
  ...[...read('kidsQuestions.ts').matchAll(/^\s*(?:free|paid)\(\d+,\s*'[^']*',\s*(?:'[^']*'|null),\s*'((?:[^'\\]|\\.){8,}?)',/gm)].map((m) => m[1].replace(/\\'/g, "'")),
  ...[...read('teenQuestions.ts').matchAll(/^\s*(?:free|paid)\(\d+,\s*'((?:[^'\\]|\\.){8,}?)',/gm)].map((m) => m[1].replace(/\\'/g, "'")),
];
const results = [];
const check = (ok, label, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.route('**/api/tallies**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await page.goto(`${HOST}/feed`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check(kidsTexts.length > 50, 'loaded kids question texts to look for', String(kidsTexts.length));
for (const tab of ['FOR YOU', 'TRENDING', 'NEW']) {
  await page.getByText(tab, { exact: true }).first().click();
  await page.waitForTimeout(900);
  const body = await page.evaluate(() => document.body.innerText);
  const lines = new Set(body.split('\n').map((l) => l.trim()));
  const hits = kidsTexts.filter((t) => lines.has(t)); // whole-line match: an adult option can start with the same words
  check(hits.length === 0, `tab ${tab}: no kids question text on screen`, hits.slice(0, 2).join(' | '));
}
const chips = await page.evaluate(() => document.body.innerText);
const youngLabels = CATEGORIES.filter((c) => c.audience !== 'adult').map((c) => c.label);
const chipHits = youngLabels.filter((l) => new RegExp(`(^|\\n)\\s*[^\\n]*${l.replace(/[-]/g, '\\-')}`).test(chips));
check(chipHits.length === 0, 'category chips: no kids or teen category', chipHits.join(', '));
const keys = await page.evaluate(() => Object.keys(localStorage));
check(keys.includes('wyr_visitor_id'), 'adult /feed still persists wyr_visitor_id (analytics unchanged)');
await b.close();
const ok = results.every(Boolean);
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(ok ? 0 : 1);
