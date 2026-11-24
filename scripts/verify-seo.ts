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
import { CATEGORIES, QUESTIONS, getCategoryQuestions, isKidsCategoryId, isQuestionLocked } from '../constants/questions';
import { SEO, SITE_URL } from '../constants/config';
import { SEO_PAGES, getRelatedSeoPages, getSeoPageQuestions, isKidsPage, listsFullWrittenSet } from '../constants/seoPages';
import { CANONICAL_ORIGIN } from '../lib/site';
import { SEO_FIRST_BATCH, isSeoBatchId } from '../lib/seoBatch';
import { categoriesIndexJsonLd, categoryJsonLd, homeJsonLd, landingPageJsonLd } from '../lib/seo';

const ROOT = resolve(__dirname, '..');
const withDist = process.argv.includes('--dist');
const failures: string[] = [];
const warnings: string[] = [];
const fail = (msg: string) => failures.push(msg);
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf-8');
const host = new URL(SITE_URL).host;
if (process.env.VERCEL_ENV === 'production' && SITE_URL.replace(/\/+$/, '') !== CANONICAL_ORIGIN) fail(`SITE_URL "${SITE_URL}" differs from CANONICAL_ORIGIN "${CANONICAL_ORIGIN}" in a production build (lib/site.js)`);

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
    let path: string;
    try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
    out.push(path);
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
  const games = linkedPaths(['/game/mc%2D2', '/game/%6dc-2', '/game/mc-2?cat=kids-family'].map((h) => `<a href="${h}">x</a>`).join(''));
  if (games.some((p) => p !== '/game/mc-2')) fail(`self-test: game links normalized to ${JSON.stringify(games)}`);
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
    // D4: kids pages list their full written set, locked or not (constants/seoPages.ts).
    if (!listsFullWrittenSet(page) && isQuestionLocked(cat, idx, false)) fail(`registry: "${page.slug}" lists locked question ${q.id}`);
  }

  // Child safety: a kids page lists only Kids & Family questions, its play flow stays in that
  // bank (the game's "next" walks the question's own category), and it links only to kids pages.
  if (isKidsPage(page)) {
    for (const id of page.categoryIds) {
      if (!isKidsCategoryId(id)) fail(`kids: "${page.slug}" must draw only from kids-audience categories (has ${id})`);
    }
    for (const q of questions) {
      if (!isKidsCategoryId(q.category)) fail(`kids: "${page.slug}" lists ${q.id} from ${q.category}, outside the kids bank`);
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
  '/kids',
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
for (const path of ['/', '/categories', '/kids', ...CATEGORIES.map((c) => `/categories/${c.id}`), ...SEO_PAGES.map((p) => `/${p.slug}`)]) {
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
// A question in the first SEO batch is indexed at /q/<id>; its playable /game/<id> is out of the sitemap (it canonicalises to /q/<id>).
for (const loc of freeGameUrls) {
  const id = loc.slice(loc.lastIndexOf('/') + 1);
  if (isSeoBatchId(id)) { if (locSet.has(loc)) fail(`sitemap: lists ${loc}, which canonicalises to /q/${id}`); }
  else if (!locSet.has(loc)) fail(`sitemap: missing playable question URL ${loc}`);
}
for (const id of SEO_FIRST_BATCH) {
  if (!QUESTIONS.some((q) => q.id === id)) fail(`seo batch: ${id} is not a question`);
  if (!locSet.has(url(`/q/${id}`))) fail(`sitemap: missing read-only question page /q/${id}`);
}

// The canonical for a playable /game/<id> whose question has a read-only page must be in the server response (vercel.json Link header).
{
  const vercel = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const link = new Map(vercel.headers.map((h) => [h.source, h.headers.find((x) => x.key === 'Link')?.value]));
  for (const id of SEO_FIRST_BATCH) {
    if (link.get(`/game/${id}`) !== `<${CANONICAL_ORIGIN}/q/${id}>; rel="canonical"`) fail(`vercel.json: no canonical Link header on /game/${id} (run node scripts/sync-vercel-canonicals.mjs)`);
  }
}

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
  // Kids pages publish their full written set on purpose (D4), so those texts are not "locked leaks".
  const publicByDesign = new Set(SEO_PAGES.filter(listsFullWrittenSet).flatMap((p) => getSeoPageQuestions(p).map((q) => q.id)));
  const lockedTexts = QUESTIONS.flatMap((q) => {
    if (publicByDesign.has(q.id)) return [];
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
    // link only to kids destinations.
    if (page && isKidsPage(page)) {
      // Allowlist, not a denylist: every same-site link on a kids page must be the home page,
      // the kids category, a kids game question, another kids page, or a static asset.
      const kidsIds = new Set(QUESTIONS.filter((q) => isKidsCategoryId(q.category)).map((q) => q.id));
      const kidsSlugs = new Set(SEO_PAGES.filter(isKidsPage).map((sp) => sp.slug));
      for (const path of linkedPaths(html)) {
        const bare = path.replace(/\/+$/, '').replace(/\.html$/, '') || '/';
        const game = bare.match(/^\/game\/([^/]+)$/);
        const ok =
          bare === '/' ||
          (bare.startsWith('/categories/') && isKidsCategoryId(bare.slice('/categories/'.length))) ||
          (game !== null && kidsIds.has(game[1])) ||
          kidsSlugs.has(bare.slice(1)) ||
          /^\/(_expo|assets)\//.test(bare) ||
          /\.(ico|png|svg|jpe?g|webp|css|js|json|xml|txt|woff2?)$/.test(bare);
        if (!ok) fail(`${label}: kids page links to ${path}, which is not a kids destination`);
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

  // Share pages and the home page must carry crawler-readable Open Graph / Twitter tags in the
  // static HTML (iMessage, Slack, WhatsApp, X, Facebook and LinkedIn do not run JavaScript) (#122).
  const meta = (html: string, attr: string, key: string) =>
    unescape(tag(html, new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`)));
  const ogChecks: { file: string; url: string; image: RegExp; h: string }[] = [
    { file: 'dist/index.html', url: SITE_URL, image: /\/api\/og$|\/api\/card\?/, h: '' },
    ...QUESTIONS.map((q) => ({
      file: `dist/p/${q.id}.html`,
      url: `${SITE_URL}/p/${q.id}`,
      image: new RegExp(`/api/og\\?id=${q.id}$`),
      h: '630',
    })),
  ];
  for (const c of ogChecks) {
    if (!existsSync(resolve(ROOT, c.file))) { fail(`dist: ${c.file} was not exported`); continue; }
    const html = read(c.file);
    const og = (k: string) => meta(html, 'property', k);
    if (!og('og:title')) fail(`${c.file}: og:title is missing`);
    if (!og('og:description')) fail(`${c.file}: og:description is missing`);
    if (og('og:url') !== c.url) fail(`${c.file}: og:url is "${og('og:url')}", expected ${c.url}`);
    if (og('og:site_name') !== 'Would You Rather?') fail(`${c.file}: og:site_name is "${og('og:site_name')}"`);
    if (!og('og:image') || !c.image.test(og('og:image')!) || !og('og:image')!.startsWith(SITE_URL)) fail(`${c.file}: og:image is "${og('og:image')}"`);
    if (c.h && og('og:image:height') !== c.h) fail(`${c.file}: og:image:height is not ${c.h}`);
    if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') fail(`${c.file}: twitter:card is not summary_large_image`);
    if (!meta(html, 'name', 'twitter:image')) fail(`${c.file}: twitter:image is missing`);
    if (!/<link[^>]*rel="apple-touch-icon"/.test(html)) fail(`${c.file}: apple-touch-icon link is missing`);
    if (!/<link[^>]*rel="(shortcut )?icon"/.test(html)) fail(`${c.file}: favicon link is missing`);
  }
}

if (withDist) {
  // Read-only question pages (docs/specs/seo-question-pages.md): exported, canonical to themselves, no script but JSON-LD, no form or vote control.
  for (const id of SEO_FIRST_BATCH) {
    const file = `dist/q/${id}.html`;
    if (!existsSync(resolve(ROOT, file))) { fail(`dist: ${file} was not exported`); continue; }
    const html = read(file);
    if (tag(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) !== url(`/q/${id}`)) fail(`${file}: canonical is not ${url(`/q/${id}`)}`);
    if (/<script(?![^>]*application\/ld\+json)/i.test(html)) fail(`${file}: has a script other than JSON-LD (the page is read-only)`);
    if (/<(button|form|input|select|textarea)\b/i.test(html)) fail(`${file}: has a form or vote control (the page is read-only)`);
    if (!html.includes(`${SITE_URL}/game/${id}`)) fail(`${file}: has no link into the playable web app`);
    const q = QUESTIONS.find((x) => x.id === id);
    if (q && isKidsCategoryId(q.category)) {
      for (const m of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
        const href = m[1];
        if (!href.startsWith(SITE_URL)) continue;
        const path = href.slice(SITE_URL.length) || '/';
        const ok = path === '/kids' || path.startsWith('/game/') || path.startsWith('/q/') || path.startsWith('/categories/') || SEO_PAGES.some((p) => `/${p.slug}` === path && isKidsPage(p));
        if (!ok) fail(`${file}: kids question page links to ${path}, which is not a kids destination`);
      }
    }
  }
  // The playable page and the legacy share page point their canonical at the read-only page.
  for (const id of SEO_FIRST_BATCH) {
    const share = `dist/p/${id}.html`;
    if (existsSync(resolve(ROOT, share)) && tag(read(share), /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) !== url(`/q/${id}`)) fail(`${share}: canonical is not ${url(`/q/${id}`)}`);
  }
}

for (const w of warnings) console.warn(`verify-seo: warning: ${w}`);
if (failures.length) {
  console.error(`verify-seo: ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`verify-seo: OK — ${SEO_PAGES.length} landing pages, ${locs.length} sitemap URLs on ${host}${withDist ? ', exported HTML checked' : ''}`);
