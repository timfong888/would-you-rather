/**
 * Cold loads of gated URLs on the exported web build (verifier FAIL on PR #128).
 *   VERCEL_ENV=production npm run build:web && node tests/browserless/locked-cold-load.mjs
 * Serves dist/ with vercel.json's rewrites (like production), opens each URL in a fresh browser
 * context and checks where it lands, that the page is not blank, and that nothing threw.
 * Before the fix, router.replace ran before the root navigator mounted ("Attempted to navigate
 * before mounting the Root Layout component") and the whole page went blank.
 * Needs a build without a RevenueCat web key, so entitlements settle at once.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = path.resolve(process.env.DIST || 'dist');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const rewrites = (vercel.rewrites || []).map((r) => ({
  re: new RegExp('^' + r.source.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'),
  dest: r.destination,
}));

function resolve(urlPath) {
  for (const { re, dest } of rewrites) {
    const m = urlPath.match(re);
    if (m) return dest.replace(/:(\w+)/g, (_, k) => m.groups[k]);
  }
  return urlPath;
}

// Like Vercel: an existing file wins; otherwise the first matching rewrite applies.
const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, urlPath);
  if (!isFile(f)) f = path.join(DIST, resolve(urlPath));
  if (!isFile(f) && isFile(f + '.html')) f += '.html';
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)];
  res.writeHead(200, type ? { 'content-type': type } : {});
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const HOST = `http://localhost:${server.address().port}`;

const CASES = [
  { url: '/game/hl-4?cat=high-life&idx=3', owner: false, expect: '/unlock/high-life', label: 'locked question, no access -> paywall' },
  { url: '/game/hl-20', owner: false, expect: '/unlock/high-life', label: 'locked question (bare link) -> paywall' },
  { url: '/unlock/high-life', owner: true, expect: '/categories/high-life', label: 'owner on the paywall -> back to the category' },
  { url: '/unlock/high-life', owner: false, expect: '/unlock/high-life', label: 'paywall, no access -> stays' },
  { url: '/game/hl-4?cat=high-life&idx=3', owner: true, expect: '/game/hl-4', label: 'owner on a locked question -> plays it' },
];

const browser = await chromium.launch();
let failed = 0;
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (c.owner) await page.addInitScript(() => localStorage.setItem('wyr_owner_access', 'granted'));
  await page.goto(HOST + c.url);
  await page.waitForFunction((want) => location.pathname === want, c.expect, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  const pathname = new URL(page.url()).pathname;
  const text = ((await page.textContent('body')) || '').trim();
  const navErrors = errors.filter((m) => /before mounting the Root Layout/.test(m));
  const ok = pathname === c.expect && text.length > 0 && navErrors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.label}  (landed ${pathname}, ${text.length} chars${navErrors.length ? ', ' + navErrors[0] : ''})`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
