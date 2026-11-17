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
import { KIDS_CATEGORY, SEO_PAGES, getRelatedSeoPages, getSeoPageQuestions, isKidsPage } from '../constants/seoPages';
import { categoriesIndexJsonLd, categoryJsonLd, homeJsonLd, landingPageJsonLd } from '../lib/seo';

const ROOT = resolve(__dirname, '..');
const withDist = process.argv.includes('--dist');
const failures: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => failures.push(msg);
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');
const host = new URL(SITE_URL).host;

// --- Registry ---------------------------------------------------------------
const seen = { slug: new Set<string>(), title: new Set<string>(), description: new Set<string>() };
/**
 * Same-site pathnames of every href in the HTML, with query strings, hashes, absolute
 * site URLs, trailing slashes and HTML entities normalized away.
 */
function linkedPaths(html: string): string[] {
  const out: string[] = [];
  for (const [, raw] of html.matchAll(/href\s*=\s*["']([^"']*)["']/gi)) {
    const href = raw.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').trim();
    let url: URL;
    try { url = new URL(href, SITE_URL); } catch { continue; }
    if (url.origin !== new URL(SITE_URL).origin) continue;
    out.push(decodeURIComponent(url.pathname));
  }
  return out;
}

// Self-test: links that dress up an adult path (query, hash, absolute URL, trailing slash,
// .html) must still resolve to it, and off-site links must be ignored.
{
  const fixture = ['/questions-for-couples?from=kids', '/questions-for-couples#questions',
    `${SITE_URL}/questions-for-couples/`, '/questions-for-couples.html', 'https://example.com/questions-for-couples']
    .map((h) => `<a href="${h}">x</a>`).join('');
  const got = linkedPaths(fixture).map((p) => p.replace(/^\/+|\/+$/g, '').replace(/\.html$/, ''));
  if (got.length !== 4 || got.some((p) => p !== 'questions-for-couples')) fail(`self-test: linkedPaths normalized to ${JSON.stringify(got)}`);
}

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

  // Child safety: a kids page lists only Kids & Family questions, its play flow stays in that
  // bank (the game's "next" walks the question's own category), and it links only to kids pages.
  if (isKidsPage(page)) {
    if (page.categoryIds.length !== 1 || page.categoryIds[0] !== KIDS_CATEGORY) {
      fail(`kids: "${page.slug}" must draw only from ${KIDS_CATEGORY} (has ${page.categoryIds.join(', ')})`);
    }
    for (const q of questions) {
      if (q.category !== KIDS_CATEGORY) fail(`kids: "${page.slug}" lists ${q.id} from ${q.category}, outside the kids bank`);
    }
    const { samePersona, other } = getRelatedSeoPages(page);
    for (const p of [...samePersona, ...other]) {
      if (!isKidsPage(p)) fail(`kids: "${page.slug}" links to non-kids page "${p.slug}"`);
    }
  }

  // Route file, rewrite.
  if (!existsSync(resolve(ROOT, `app/${page.slug}.tsx`))) fail(`route: app/${page.slug}.tsx is missing`);

  if (page.updated && !/^\d{4}-\d{2}-\d{2}$/.test(page.updated)) fail(`registry: "${page.slug}" updated must be YYYY-MM-DD`);

  // Not a thin page: pages written to a question bank must carry their own copy.
  if (page.questionTag && (!page.intro?.length || !page.tips?.length)) {
    fail(`registry: "${page.slug}" has no intro or tips (every page needs its own useful copy)`);
  }
}

// --- One page per question ----------------------------------------------------
// Every page publishes its own questions; the same text on two pages is the
// duplicate, mass-produced pattern Google demotes.
const owner = new Map<string, string>();
for (const page of SEO_PAGES) {
  for (const q of getSeoPageQuestions(page)) {
    const prev = owner.get(q.id);
    if (prev) fail(`registry: question ${q.id} appears on both "${prev}" and "${page.slug}"`);
    owner.set(q.id, page.slug);
  }
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

// AI search crawlers must never be blocked.
if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt: contains "Disallow: /" (would block search and AI crawlers)');
for (const bot of ['OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Googlebot', 'Bingbot']) {
  if (!robots.includes(`User-agent: ${bot}`)) fail(`robots.txt: no explicit group for ${bot}`);
}

// llms.txt lists every landing page; llms-full.txt carries each page's questions.
for (const f of ['llms.txt', 'llms-full.txt']) if (!existsSync(resolve(ROOT, `public/${f}`))) fail(`public/${f} is missing`);
if (existsSync(resolve(ROOT, 'public/llms.txt'))) {
  const llms = read('public/llms.txt');
  for (const page of SEO_PAGES) if (!llms.includes(`${SITE_URL}/${page.slug}`)) fail(`llms.txt: missing ${page.slug}`);
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
    {
      // Its title/description are set in the screen; check they exist, not their wording.
      file: 'dist/categories.html',
      canonical: `${SITE_URL}/categories`,
      title: undefined as string | undefined,
      description: undefined as string | undefined,
      h1: false,
      expected: categoriesIndexJsonLd(CATEGORIES),
    },
  ];

  for (const p of pages) {
    if (!existsSync(resolve(ROOT, p.file))) { fail(`dist: ${p.file} was not exported`); continue; }
    const html = read(p.file);
    const label = p.file;
    const gotTitle = unescape(tag(html, /<title[^>]*>([^<]*)<\/title>/));
    const gotDescription = unescape(tag(html, /<meta[^>]*name="description"[^>]*content="([^"]*)"/));
    if (p.title === undefined ? !gotTitle : gotTitle !== p.title) fail(`${label}: <title> is ${gotTitle ? `"${gotTitle}"` : 'empty'}${p.title ? `, expected "${p.title}"` : ''}`);
    if (p.description === undefined ? !gotDescription : gotDescription !== p.description) fail(`${label}: meta description ${gotDescription ? 'does not match' : 'is missing'}`);
    if (tag(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) !== p.canonical) fail(`${label}: canonical is not ${p.canonical}`);
    if (!/<meta[^>]*name="robots"[^>]*content="index, follow"/.test(html)) fail(`${label}: robots is not "index, follow"`);
    const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
    if (p.h1 && h1s !== 1) fail(`${label}: expected exactly one <h1>, found ${h1s}`);
    const blocks = jsonLdBlocks(html);
    if (blocks.length !== 1) fail(`${label}: expected exactly one JSON-LD block, found ${blocks.length}`);
    else if (!isDeepStrictEqual(blocks[0], JSON.parse(JSON.stringify(p.expected)))) fail(`${label}: JSON-LD differs from what lib/seo.ts builds`);
    const page = SEO_PAGES.find((sp) => `dist/${sp.slug}.html` === p.file);
    if (page?.answer && !unescape(html)?.includes(page.answer)) fail(`${label}: answer-first text is not in the static HTML`);
    // Child safety, checked on the shipped HTML too: kids pages play only kids questions and
    // link to no adult landing page.
    if (page && isKidsPage(page)) {
      const kidsIds = new Set(QUESTIONS.filter((q) => q.category === KIDS_CATEGORY).map((q) => q.id));
      for (const [, id] of html.matchAll(/\/game\/([a-z]+-\d+)/g)) {
        if (!kidsIds.has(id)) { fail(`${label}: kids page links to /game/${id}, outside the kids bank`); break; }
      }
      const adult = new Set(SEO_PAGES.filter((sp) => !isKidsPage(sp)).map((sp) => sp.slug));
      for (const path of linkedPaths(html)) {
        const slug = path.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
        if (adult.has(slug)) fail(`${label}: kids page links to adult page /${slug}`);
      }
    }
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
  for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt']) {
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
