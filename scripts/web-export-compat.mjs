/**
 * Keep the Expo SDK 54 web export behaving like the SDK 51 export that production was built on.
 *
 * 1. Flat index routes. Expo Router 6 writes app/categories/index.tsx as dist/categories/index.html;
 *    Expo Router 3 wrote dist/categories.html, and vercel.json (`/categories -> /categories.html`)
 *    plus verify-seo rely on that layout. Each nested index.html is moved back to <route>.html.
 *
 * 2. No hydration. SDK 54 adds `globalThis.__EXPO_ROUTER_HYDRATE__=true` to every exported page, so
 *    React hydrates the static HTML instead of rendering it fresh (SDK 51 rendered fresh). Several
 *    pages are served HTML that cannot match the client: the dynamic templates (game/[id].html is
 *    rendered with no id, so it says "Question not found") and paths that Vercel answers with
 *    index.html (/settings, /privacy, ...). Hydrating those throws React error #418. Removing the
 *    flag keeps the static HTML for crawlers and first paint, and the client renders as before.
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../dist');
const HYDRATE_SCRIPT = '<script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>';

for (const name of readdirSync(DIST)) {
  const dir = join(DIST, name);
  if (name.startsWith('_') || !statSync(dir).isDirectory()) continue;
  const index = join(dir, 'index.html');
  const flat = join(DIST, `${name}.html`);
  if (!existsSync(index)) continue;
  if (existsSync(flat)) throw new Error(`web-export-compat: both ${name}.html and ${name}/index.html exist`);
  renameSync(index, flat);
  console.log(`web-export-compat: dist/${name}/index.html -> dist/${name}.html`);
}

let stripped = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== '_expo' && name !== 'assets') walk(path); continue; }
    if (!name.endsWith('.html')) continue;
    const html = readFileSync(path, 'utf8');
    if (!html.includes(HYDRATE_SCRIPT)) continue;
    writeFileSync(path, html.replace(HYDRATE_SCRIPT, ''));
    stripped++;
  }
};
walk(DIST);
if (stripped === 0) throw new Error('web-export-compat: no hydrate flag found; the Expo export format changed, re-check this script');
console.log(`web-export-compat: removed the hydrate flag from ${stripped} pages`);
