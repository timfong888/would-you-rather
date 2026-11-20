// #109: content on screens without a native header must stay out from under the status bar,
// notch and Dynamic Island on every iPhone. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { insetPadding } from '../../lib/safeArea';
import { SEO_PAGES } from '../../constants/seoPages';

test('insetPadding adds the device insets to the content padding', () => {
  // iPhone with a Dynamic Island: 59pt top, 34pt home indicator
  assert.deepEqual(insetPadding({ paddingTop: 12, paddingBottom: 48 }, { top: 59, bottom: 34 }), { paddingTop: 71, paddingBottom: 82 });
  assert.deepEqual(insetPadding({ paddingVertical: 8 }, { top: 20, bottom: 0 }), { paddingTop: 28, paddingBottom: 8 });
  assert.deepEqual(insetPadding({ padding: 4 }, { top: 47, bottom: 34 }), { paddingTop: 51, paddingBottom: 38 });
  assert.deepEqual(insetPadding(undefined, { top: 20, bottom: 0 }), { paddingTop: 20, paddingBottom: 0 });
});

test('insetPadding changes nothing when there are no insets (web stays identical)', () => {
  assert.equal(insetPadding({ paddingTop: 12 }, { top: 0, bottom: 0 }), null);
});

// Every route registered with `headerShown: false` in app/_layout.tsx must apply the top inset itself,
// via SafeScrollView or useSafeAreaInsets, in its own file or in a component it renders.
const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const SAFE = /\bSafeScrollView\b|\buseSafeAreaInsets\b/;

function headerlessRouteFiles(): string[] {
  const layout = read('app/_layout.tsx');
  const names = new Set<string>();
  for (const m of layout.matchAll(/<Stack\.Screen[^>]*?name="([^"]+)"[^>]*?headerShown:\s*false/gs)) names.add(m[1]);
  // multi-line form: name="x" ... options={{ ... headerShown: false
  for (const m of layout.matchAll(/name="([^"]+)"\s*\n?\s*options=\{\{[^}]*headerShown:\s*false/gs)) names.add(m[1]);
  if (/SEO_PAGES\.map[\s\S]*?headerShown:\s*false/.test(layout)) for (const p of SEO_PAGES) names.add(p.slug);
  return [...names].map((n) => `app/${n}.tsx`);
}

function usesInsets(file: string): boolean {
  const src = read(file);
  if (SAFE.test(src)) return true;
  // one level down: components the route renders (e.g. the SEO pages render SeoLandingPage)
  for (const m of src.matchAll(/from '@\/components\/([\w/]+)'/g)) {
    const comp = `components/${m[1]}.tsx`;
    if (existsSync(join(ROOT, comp)) && SAFE.test(read(comp))) return true;
  }
  return false;
}

test('every headerless route keeps its content out of the status bar (SafeScrollView or useSafeAreaInsets)', () => {
  const files = headerlessRouteFiles();
  assert.ok(files.includes('app/index.tsx') && files.includes('app/unlock/[id].tsx') && files.length > 10, `found ${files.join(', ')}`);
  const missing = files.filter((f) => !existsSync(join(ROOT, f)) || !usesInsets(f));
  assert.deepEqual(missing, [], `headerless routes without safe-area insets: ${missing.join(', ')}`);
});
