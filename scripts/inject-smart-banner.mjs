/**
 * Apple Smart App Banner on every exported page (#134).
 *
 * Adds <meta name="apple-itunes-app" content="app-id=…"> to each HTML file in dist/, share pages
 * included. Runs after generate-sharing-pages.mjs. It must be in the served HTML: Safari reads it
 * at load, not from tags the client adds later. No app-argument (see addSmartBanner in
 * lib/appStore.js); a tapped share link opens the installed app through Universal Links.
 *
 * Kids pages get the banner too: it is Apple's, loads nothing from us and sends us nothing
 * (docs/specs/kids-family-categories.md, "Web → app"). Safari shows no banner while the app is
 * not on the store, so this is safe before release.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addSmartBanner as addBanner } from '../lib/appStore.js';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../dist');
let pages = 0;
let share = 0;
const walk = (dir, rel) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '_expo' && name !== 'assets') walk(path, `${rel}${name}/`);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    const isShare = rel === 'p/';
    const html = readFileSync(path, 'utf8');
    const out = addBanner(html);
    if (out !== html) {
      writeFileSync(path, out);
      pages++;
      if (isShare) share++;
    }
  }
};
walk(DIST, '');
if (share === 0) throw new Error('inject-smart-banner: no share pages found; run generate-sharing-pages first');
console.log(`inject-smart-banner: added the Smart App Banner to ${pages} pages (${share} share pages)`);
