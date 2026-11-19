#!/usr/bin/env node
/**
 * Generates App Store screenshots by running the app (web build) in headless
 * Chromium at the exact pixel sizes App Store Connect asks for.
 *
 *   EXPO_PUBLIC_IOS_V1_CATALOG=1 npx expo start --web --port 8099   # in another terminal
 *
 * The flag applies the iOS v1 catalog (Midnight Secrets and Deep Desires left out,
 * constants/iosV1.ts) so the screenshots match what ships. Requires the payments PR's
 * constants/platformFilter.ts. iPhone only (iOS v1 is iPhone-only).
 *   node scripts/store/screenshots.mjs [baseUrl]
 *
 * Needs `playwright` resolvable (globally, or `npm i --no-save playwright`).
 * Output: store/ios/screenshots/<device>/NN-name.png
 *
 * These are the web rendering of the app, not simulator captures. Tim reviews
 * them before anything is uploaded; swap in simulator captures if the native
 * chrome matters.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:8099';
const OUT = path.resolve(process.env.SHOTS_OUT ?? 'store/ios/screenshots');

// css viewport x scale = required pixel size
const DEVICES = [
  { name: 'iphone-6.9', w: 440, h: 956, scale: 3 }, // 1320 x 2868
  { name: 'iphone-6.5', w: 428, h: 926, scale: 3 }, // 1284 x 2778
];

const settle = (page, ms = 1200) => page.waitForTimeout(ms);

async function run() {
  const browser = await chromium.launch();
  for (const d of DEVICES) {
    const dir = path.join(OUT, d.name);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      deviceScaleFactor: d.scale,
      isMobile: d.name.startsWith('iphone'),
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const shot = async (n, name) => {
      await settle(page);
      await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
    };
    const open = async (url) => {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
      await settle(page, 2500);
    };

    await open('/');
    await shot(1, 'home');
    await open('/categories');
    await shot(2, 'categories');
    await open('/categories/high-life');
    await shot(3, 'category');
    await open('/game/hl-1?cat=high-life&idx=0');
    await shot(4, 'question');
    await page.getByText('Have a private yacht').first().click();
    await page.getByText('CONFIRM PREFERENCE').click();
    await settle(page, 2500);
    await shot(5, 'answered');
    // Dark mode: the moon toggle in the header.
    await open('/');
    await page.getByText('🌙').first().click();
    await shot(6, 'home-dark');

    await ctx.close();
  }
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
