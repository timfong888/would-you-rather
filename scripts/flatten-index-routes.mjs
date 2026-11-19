/**
 * Expo Router 6 (SDK 54) exports a nested index route such as app/categories/index.tsx as
 * dist/categories/index.html. Expo Router 3 (SDK 51) wrote dist/categories.html, and vercel.json
 * (`/categories -> /categories.html`) plus verify-seo rely on that layout. Move each nested
 * index.html back to <route>.html so the deployed site is served exactly as before.
 */
import { existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '../dist');

for (const name of readdirSync(DIST)) {
  const dir = join(DIST, name);
  if (name.startsWith('_') || !statSync(dir).isDirectory()) continue;
  const index = join(dir, 'index.html');
  const flat = join(DIST, `${name}.html`);
  if (!existsSync(index)) continue;
  if (existsSync(flat)) throw new Error(`flatten-index-routes: both ${name}.html and ${name}/index.html exist`);
  renameSync(index, flat);
  console.log(`flatten-index-routes: dist/${name}/index.html -> dist/${name}.html`);
}
