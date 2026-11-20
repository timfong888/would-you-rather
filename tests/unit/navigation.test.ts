// #118: every screen in the native app needs a way back or home. Routes with the stack header get the
// native back button; routes registered with `headerShown: false` must provide their own control.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEO_PAGES } from '../../constants/seoPages';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
// The home screen is the stack root: nothing to go back to.
const ROOT_ROUTES = new Set(['index']);
// A control that leaves the screen: the shared bar, or an explicit router.back / replace / push call.
const NAV = /\bNativeBackBar\b|router\.back\(|router\.replace\(|router\.push\('\/(categories)?'\)/;

function headerlessRoutes(): string[] {
  const layout = read('app/_layout.tsx');
  const names = new Set<string>();
  for (const m of layout.matchAll(/name="([^"]+)"\s*\n?\s*options=\{\{[^}]*headerShown:\s*false/gs)) names.add(m[1]);
  if (/SEO_PAGES\.map[\s\S]*?headerShown:\s*false/.test(layout)) for (const p of SEO_PAGES) names.add(p.slug);
  return [...names].filter((n) => !ROOT_ROUTES.has(n));
}

function hasNav(file: string): boolean {
  const src = read(file);
  if (NAV.test(src)) return true;
  for (const m of src.matchAll(/from '@\/components\/([\w/]+)'/g)) {
    const comp = `components/${m[1]}.tsx`;
    if (existsSync(join(ROOT, comp)) && NAV.test(read(comp))) return true;
  }
  return false;
}

test('every headerless native route has back or home navigation', () => {
  const routes = headerlessRoutes();
  assert.ok(routes.includes('complete/[id]') && routes.includes('unlock/[id]') && routes.length > 10, `found ${routes.join(', ')}`);
  const missing = routes.filter((n) => !hasNav(`app/${n}.tsx`));
  assert.deepEqual(missing, [], `headerless routes with no way back or home: ${missing.join(', ')}`);
});

test('every landing page renders the back bar through SeoLandingPage', () => {
  assert.ok(/<NativeBackBar\s*\/>/.test(read('components/SeoLandingPage.tsx')));
  for (const p of SEO_PAGES) assert.ok(/SeoLandingPage/.test(read(`app/${p.slug}.tsx`)), `${p.slug} must render SeoLandingPage`);
});

test('the back bar is native only, so the web landing pages are unchanged', () => {
  assert.ok(/Platform\.OS === 'web'\) return null/.test(read('components/NativeBackBar.tsx')));
});

test('every route file is either root, headerless with navigation, or gets the stack header', () => {
  const headerless = new Set(headerlessRoutes());
  const layout = read('app/_layout.tsx');
  for (const n of headerless) assert.ok(existsSync(join(ROOT, `app/${n}.tsx`)), `${n} is registered but has no file`);
  // Every other registered screen must not hide its header.
  for (const m of layout.matchAll(/name="([^"]+)"/g)) {
    if (ROOT_ROUTES.has(m[1]) || headerless.has(m[1])) continue;
    const block = layout.slice(layout.indexOf(m[0]), layout.indexOf('/>', layout.indexOf(m[0])));
    assert.ok(!/headerShown:\s*false/.test(block), `${m[1]} hides its header without being detected as headerless`);
  }
});
