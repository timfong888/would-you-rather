#!/usr/bin/env node
/**
 * Renders the App Review screenshot for each in-app purchase in
 * store/ios/iap-products.json: the paywall that sells it, at iPhone 6.7"
 * size (1290x2796), into store/ios/iap-review/<productId>.png.
 *
 * Build first, without any free unlock and with a placeholder sandbox key so
 * the paywall shows its real purchase buttons and the approved prices:
 *   EXPO_PUBLIC_DEPLOY_ENV=development EXPO_PUBLIC_RC_WEB_KEY=rcb_sb_screenshot npm run build:web
 *   git checkout -- public/
 *   node scripts/render-iap-review-screenshots.mjs
 * With no stored RevenueCat user the web SDK is never configured, so nothing
 * goes over the network and the paywall shows the approved $1.99 / $4.99.
 *
 * Each shot is checked before it is written: it must show the product's price
 * and name, and never "FREE FOR NOW" or "TEST MODE".
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let DIST = '';
const OUT = path.join(ROOT, 'store/ios/iap-review');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'store/ios/iap-products.json'), 'utf8'));

/** Which paywall sells each product, and the text the shot must show. */
export function shotPlan(products) {
  return products.map((p) => {
    if (p.productId === 'wyr_premium_all') {
      // The pack is sold on every category paywall ("Or unlock every category").
      return { ...p, route: '/unlock/high-life', mustShow: [`$${p.priceUsd}`, 'unlock every category'] };
    }
    const category = p.productId.replace(/^wyr_unlock_/, '').replace(/_/g, '-');
    return { ...p, route: `/unlock/${category}`, mustShow: [`$${p.priceUsd}`, p.displayName] };
  });
}

export const FORBIDDEN = ['FREE FOR NOW', 'TEST MODE'];

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = (vercel.rewrites || []).map((r) => ({
  re: new RegExp('^' + r.source.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'),
  dest: r.destination,
}));
const resolve = (u) => {
  for (const { re, dest } of rewrites) {
    const m = u.match(re);
    if (m) return dest.replace(/:(\w+)/g, (_, k) => m.groups[k]);
  }
  return u;
};
// Only files inside DIST are served (after resolving `..` and symlinks).
const inDist = (f) => {
  try {
    const real = fs.realpathSync(f);
    return (real === DIST || real.startsWith(DIST + path.sep)) && fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
};

async function main() {
  DIST = fs.realpathSync(path.resolve(process.env.DIST || path.join(ROOT, 'dist')));
  const server = http.createServer((req, res) => {
    let u;
    try { u = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    const f = [u, resolve(u)].flatMap((p) => [path.join(DIST, p), path.join(DIST, p) + '.html']).map(inDist).find(Boolean);
    if (!f) { res.writeHead(404); return res.end(); }
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)];
    res.writeHead(200, type ? { 'content-type': type } : {});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); // loopback only
  const host = `http://127.0.0.1:${server.address().port}`;

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let failed = 0;
  for (const shot of shotPlan(spec.products)) {
    // 430x932 CSS px at 3x = 1290x2796, the iPhone 6.7" screenshot size.
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: 'light' });
    const page = await ctx.newPage();
    // Belt and braces: nothing leaves the machine (no RevenueCat, no analytics).
    await page.route('**/*', (route) => (route.request().url().startsWith(host) ? route.continue() : route.abort()));
    await page.goto(host + shot.route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if (shot.productId === 'wyr_premium_all') {
      // The pack button, with the category price and buy button above it.
      await page.getByText(/unlock every category/i).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    } else {
      // Start the frame at the line naming the category, so the category name, price and buy button all show.
      await page.getByText(shot.displayName).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.mouse.wheel(0, -120);
    }
    await page.waitForTimeout(300);
    const text = await page.innerText('body');
    const bad = FORBIDDEN.filter((t) => text.includes(t));
    // Every required text must be on screen in the frame, not just somewhere on the page.
    const missing = [];
    for (const t of [...shot.mustShow, shot.productId === 'wyr_premium_all' ? null : 'MORE CONVERSATIONS'].filter(Boolean)) {
      const box = await page.getByText(t, { exact: false }).first().boundingBox().catch(() => null);
      if (!box || box.y < 0 || box.y + box.height > 932) missing.push(t);
    }
    const file = path.join(OUT, `${shot.productId}.png`);
    if (missing.length || bad.length || new URL(page.url()).pathname !== shot.route) {
      failed++;
      console.error(`FAIL ${shot.productId}: missing ${JSON.stringify(missing)}, forbidden ${JSON.stringify(bad)}, at ${page.url()}`);
    } else {
      await page.screenshot({ path: file });
      console.log(`wrote ${path.relative(ROOT, file)} (${shot.route})`);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  if (failed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
