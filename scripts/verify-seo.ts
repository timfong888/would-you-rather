#!/usr/bin/env tsx
/**
 * Build-time SEO consistency checks. Fails the build if the things that have to
 * agree about the SEO pages have drifted apart.
 *
 *   tsx scripts/verify-seo.ts          source checks (registry, routes, rewrites,
 *                                      sitemap, robots)
 *   tsx scripts/verify-seo.ts --dist   the same, plus the exported HTML in dist/
 *
 * The registry (constants/seoPages.ts) is the single source of truth; this script
 * is what makes "add a page" a checked procedure rather than a memory test.
 */
import { existsSync, readFileSync } from 'fs';
import { isDeepStrictEqual } from 'util';
import { resolve } from 'path';
import { CATEGORIES, QUESTIONS, getCategoryQuestions, isQuestionLocked } from '../constants/questions';
import { SEO, SITE_URL } from '../constants/config';
import { SEO_PAGES, getSeoPageQuestions } from '../constants/seoPages';
import { categoryJsonLd, homeJsonLd, landingPageJsonLd } from '../lib/seo';

const ROOT = resolve(__dirname, '..');
const withDist = process.argv.includes('--dist');
const failures: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => failures.push(msg);
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');
const host = new URL(SITE_URL).host;

// --- Registry ---------------------------------------------------------------
const seen = { slug: new Set<string>(), title: new Set<string>(), description: new Set<string>() };
for (const page of SEO_PAGES) {
  for (const key of ['slug', 'title', 'description'] as const) {
    const value = page[key];
    if (!value.trim()) fail(`registry: "${page.slug}" has an empty ${key}`);
    if (seen[key].has(value)) fail(`registry: duplicate ${key} "${value}"`);
    seen[key].add(value);
  }
  if (page.title.length > 70) warnings.push(`"${page.slug}" title is ${page.title.length} chars (search results cut off near 60)`);
  if (page.description.length > 160) warnings.push(`"${page.slug}" description is ${page.description.length} chars (cut off near 155-160)`);

  const questions = getSeoPageQuestions(page);
  if (questions.length < 10) fail(`registry: "${page.slug}" lists only ${questions.length} questions`);
  if (new Set(questions.map((q) => q.id)).size !== questions.length) fail(`registry: "${page.slug}" repeats a question`);
  for (const q of questions) {
    const cat = CATEGORIES.find((c) => c.id === q.category)!;
    const idx = getCategoryQuestions(cat.id).findIndex((x) => x.id === q.id);
    if (isQuestionLocked(cat, idx, false)) fail(`registry: "${page.slug}" lists locked question ${q.id}`);
  }

  // Route file, rewrite.
  if (!existsSync(resolve(ROOT, `app/${page.slug}.tsx`))) fail(`route: app/${page.slug}.tsx is missing`);
}

// --- vercel.json rewrites ---------------------------------------------------
const rewrites: { source: string; destination: string }[] = JSON.parse(read('vercel.json')).rewrites;
const needsRewrite = [
  ...SEO_PAGES.map((p) => `/${p.slug}`),
  '/categories',
];
for (const source of needsRewrite) {
  const r = rewrites.find((x) => x.source === source);
  if (!r) fail(`vercel.json: no rewrite for ${source} (it would be served the home page's HTML)`);
  else if (r.destination !== `${source}.html`) fail(`vercel.json: ${source} rewrites to ${r.destination}, expected ${source}.html`);
}

// --- sitemap + robots -------------------------------------------------------
const sitemap = read('public/sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
if (locs.length === 0) fail('sitemap: no <loc> entries');
if (new Set(locs).size !== locs.length) fail('sitemap: duplicate <loc> entries');
for (const loc of locs) if (new URL(loc).host !== host) fail(`sitemap: ${loc} is not on ${host} (EXPO_PUBLIC_SITE_URL)`);
const locSet = new Set(locs);
const url = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
for (const path of ['/', '/categories', ...CATEGORIES.map((c) => `/categories/${c.id}`), ...SEO_PAGES.map((p) => `/${p.slug}`)]) {
  if (!locSet.has(url(path))) fail(`sitemap: missing ${url(path)}`);
}
const lockedGameUrls = new Set<string>();
const freeGameUrls = new Set<string>();
for (const cat of CATEGORIES) {
  getCategoryQuestions(cat.id).forEach((q, i) =>
    (isQuestionLocked(cat, i, false) ? lockedGameUrls : freeGameUrls).add(url(`/game/${q.id}`)),
  );
}
for (const loc of locs) if (lockedGameUrls.has(loc)) fail(`sitemap: lists locked question URL ${loc}`);
for (const loc of freeGameUrls) if (!locSet.has(loc)) fail(`sitemap: missing playable question URL ${loc}`);

const robots = read('public/robots.txt');
if (!robots.split('\n').some((l) => l.trim() === `Sitemap: ${SITE_URL}/sitemap.xml`)) {
  fail(`robots.txt: Sitemap line is not ${SITE_URL}/sitemap.xml`);
}

// --- Exported HTML ----------------------------------------------------------
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      fail('dist: a JSON-LD block is not valid JSON');
    }
  }
  return blocks;
}
const tag = (html: string, re: RegExp) => html.match(re)?.[1];
const unescape = (s: string | undefined) =>
  s?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

if (withDist) {
  const lockedTexts = QUESTIONS.flatMap((q) => {
    const cat = CATEGORIES.find((c) => c.id === q.category)!;
    const idx = getCategoryQuestions(cat.id).findIndex((x) => x.id === q.id);
    return isQuestionLocked(cat, idx, false) ? [q.optionA, q.optionB] : [];
  });

  const pages = [
    ...SEO_PAGES.map((page) => ({
      file: `dist/${page.slug}.html`,
      canonical: `${SITE_URL}/${page.slug}`,
      title: page.title,
      description: page.description,
      h1: true,
      expected: landingPageJsonLd(page, getSeoPageQuestions(page)),
    })),
    {
      file: 'dist/index.html',
      canonical: SITE_URL,
      title: SEO.defaultTitle,
      description: SEO.defaultDescription,
      h1: true,
      expected: homeJsonLd(SEO.defaultDescription),
    },
  ];

  for (const p of pages) {
    if (!existsSync(resolve(ROOT, p.file))) { fail(`dist: ${p.file} was not exported`); continue; }
    const html = read(p.file);
    const label = p.file;
    if (unescape(tag(html, /<title[^>]*>([^<]*)<\/title>/)) !== p.title) fail(`${label}: <title> is not "${p.title}"`);
    if (unescape(tag(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/)) !== p.description) fail(`${label}: meta description does not match`);
    if (tag(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) !== p.canonical) fail(`${label}: canonical is not ${p.canonical}`);
    if (!/<meta[^>]*name="robots"[^>]*content="index, follow"/.test(html)) fail(`${label}: robots is not "index, follow"`);
    const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
    if (p.h1 && h1s !== 1) fail(`${label}: expected exactly one <h1>, found ${h1s}`);
    const blocks = jsonLdBlocks(html);
    if (blocks.length !== 1) fail(`${label}: expected exactly one JSON-LD block, found ${blocks.length}`);
    else if (!isDeepStrictEqual(blocks[0], JSON.parse(JSON.stringify(p.expected)))) fail(`${label}: JSON-LD differs from what lib/seo.ts builds`);
    for (const text of lockedTexts) {
      if (html.includes(text) || html.includes(text.replace(/'/g, '&#x27;'))) {
        fail(`${label}: contains locked question text "${text.slice(0, 50)}…"`);
        break;
      }
    }
  }

  // Every fixed rewrite destination must be a real exported file (a rewrite to a
  // missing file is a 404 in production).
  for (const r of rewrites) {
    if (r.destination.includes(':')) continue; // parameterised, e.g. /p/:id.html
    if (!existsSync(resolve(ROOT, `dist${r.destination}`))) fail(`vercel.json: ${r.source} -> ${r.destination} does not exist in dist/`);
  }

  // Exported copies of the sitemap/robots must be the ones we just generated.
  for (const f of ['sitemap.xml', 'robots.txt']) {
    if (!existsSync(resolve(ROOT, `dist/${f}`))) fail(`dist: ${f} was not exported`);
    else if (read(`dist/${f}`) !== read(`public/${f}`)) fail(`dist: ${f} differs from public/${f}`);
  }

  // Category pages are rendered client-side from one template; check the builder
  // still produces valid, locked-text-free markup for every category.
  for (const cat of CATEGORIES) {
    const free = getCategoryQuestions(cat.id).filter((_, i) => !isQuestionLocked(cat, i, false));
    const ld = JSON.stringify(categoryJsonLd(cat, free));
    for (const text of lockedTexts) if (ld.includes(text)) { fail(`categoryJsonLd(${cat.id}) contains locked text`); break; }
  }
}

for (const w of warnings) console.warn(`verify-seo: warning: ${w}`);
if (failures.length) {
  console.error(`verify-seo: ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`verify-seo: OK — ${SEO_PAGES.length} landing pages, ${locs.length} sitemap URLs on ${host}${withDist ? ', exported HTML checked' : ''}`);
