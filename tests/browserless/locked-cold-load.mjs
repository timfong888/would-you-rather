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

const DIST = fs.realpathSync(path.resolve(process.env.DIST || 'dist'));
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

// Only files inside DIST (after resolving `..` and symlinks) are served.
function inDist(f) {
  try {
    const real = fs.realpathSync(f);
    return (real === DIST || real.startsWith(DIST + path.sep)) && fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

// Like Vercel: an existing file wins; otherwise the first matching rewrite applies.
const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('bad request'); }
  const candidates = [urlPath, resolve(urlPath)].flatMap((p) => [path.join(DIST, p), path.join(DIST, p) + '.html']);
  const f = candidates.map(inDist).find(Boolean);
  if (!f) { res.writeHead(404); return res.end('not found'); }
  const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)];
  res.writeHead(200, type ? { 'content-type': type } : {});
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); // loopback only
const HOST = `http://127.0.0.1:${server.address().port}`;

const CASES = [
  { url: '/game/hl-4?cat=high-life&idx=3', owner: false, expect: '/unlock/high-life', label: 'locked question, no access -> paywall' },
  { url: '/game/hl-20', owner: false, expect: '/unlock/high-life', label: 'locked question (bare link) -> paywall' },
  { url: '/unlock/high-life', owner: true, expect: '/categories/high-life', label: 'owner on the paywall -> back to the category' },
  { url: '/unlock/high-life', owner: false, expect: '/unlock/high-life', label: 'paywall, no access -> stays' },
  { url: '/game/hl-4?cat=high-life&idx=3', owner: true, expect: '/game/hl-4', label: 'owner on a locked question -> plays it' },
];

let failed = 0;
// The test server must not serve files outside dist/ (Vercel Security Review, PR #128).
for (const [probe, marker] of [['/../package.json', '"devDependencies"'], ['/%2e%2e/package.json', '"devDependencies"'], ['/..%2fvercel.json', '"rewrites"']]) {
  // Unknown paths fall through to the catch-all rewrite (index.html, like Vercel); the outside file must never come back.
  // http.request's `path` is sent verbatim; a URL string would normalize the dot segments away first.
  const { status, body } = await new Promise((r) => http.request({ host: '127.0.0.1', port: server.address().port, path: probe }, (res) => {
    let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => r({ status: res.statusCode, body: b }));
  }).on('error', () => r({ status: 0, body: '' })).end());
  const ok = !body.includes(marker);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  no file outside dist/ for ${probe} (HTTP ${status}${ok ? '' : ', leaked'})`);
}

const browser = await chromium.launch();
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
