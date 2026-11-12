#!/usr/bin/env tsx
/**
 * Generates public/sitemap.xml and public/robots.txt from the same data the app
 * renders from, using the one configured host (EXPO_PUBLIC_SITE_URL).
 * Runs as part of `npm run build:web`, before the export copies public/ into dist/.
 *
 * What goes in (and nothing else):
 *   /, /categories, every category, every SEO landing page (constants/seoPages.ts),
 *   and every question a first-time visitor can play for free.
 * Locked expansion/premium questions are left out: their URLs redirect to the
 * category page, and a sitemap should only list URLs that resolve to themselves.
 *
 * <lastmod> is the date of the last commit touching the content, and is omitted
 * when git can't say so honestly (no git, or a shallow clone). Search engines
 * discount a lastmod that changes on every build.
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIES, getCategoryQuestions, isQuestionLocked } from '../constants/questions';
import { SEO_PAGES } from '../constants/seoPages';
import { SITE_URL } from '../constants/config';

function lastModified(paths: string[]): string | undefined {
  try {
    const run = (cmd: string) =>
      execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (run('git rev-parse --is-shallow-repository') !== 'false') return undefined;
    const date = run(`git log -1 --format=%cs -- ${paths.join(' ')}`);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  } catch {
    return undefined;
  }
}

const CONTENT = lastModified(['constants/questions.ts']);
const PAGES = lastModified(['constants/seoPages.ts', 'components/SeoLandingPage.tsx']);

interface Entry { path: string; lastmod?: string }
const entries: Entry[] = [
  { path: '/', lastmod: PAGES },
  { path: '/categories', lastmod: CONTENT },
  ...CATEGORIES.map((c) => ({ path: `/categories/${c.id}`, lastmod: CONTENT })),
  ...SEO_PAGES.map((p) => ({ path: `/${p.slug}`, lastmod: PAGES })),
];

for (const cat of CATEGORIES) {
  getCategoryQuestions(cat.id).forEach((q, i) => {
    if (!isQuestionLocked(cat, i, false)) entries.push({ path: `/game/${q.id}`, lastmod: CONTENT });
  });
}

const loc = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => `  <url>\n    <loc>${loc(e.path)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}\n  </url>`)
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

writeFileSync(resolve(process.cwd(), 'public/sitemap.xml'), xml, 'utf-8');
writeFileSync(resolve(process.cwd(), 'public/robots.txt'), robots, 'utf-8');
console.log(`Sitemap: ${entries.length} URLs on ${new URL(SITE_URL).host} (lastmod ${CONTENT ?? 'omitted'}); robots.txt written.`);
