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
import { SEO_PAGES, getSeoPageQuestions, getSeoPageUpdated, type Persona } from '../constants/seoPages';
import { ORGANIZATION_DESCRIPTION } from '../lib/seo';
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
  { path: '/kids', lastmod: CONTENT },
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

// AI search / answer-engine crawlers are allowed explicitly, so a future blanket
// rule can't shut them out by accident. Training-only crawlers are a separate
// call (#63); they are allowed by default.
export const AI_SEARCH_BOTS = [
  'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Googlebot', 'Bingbot', 'Applebot',
];
export const AI_TRAINING_BOTS = ['GPTBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'];

const robots = `# Search engines and AI answer engines (search, citations, user-requested fetches)
${AI_SEARCH_BOTS.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /

# Model-training crawlers: allowed by default (decision tracked in #63)
${AI_TRAINING_BOTS.map((b) => `User-agent: ${b}`).join('\n')}
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

// llms.txt (https://llmstxt.org): a plain-markdown map of the site for LLMs.
// llms-full.txt carries the full text of every landing page.
const PERSONA_SECTION: Record<Persona, string> = {
  parents: 'Question lists for parents and families',
  couples: 'Question lists for couples and adults',
  groups: 'Question lists for groups and teens',
};
const personas = [...new Set(SEO_PAGES.map((p) => p.persona))];
const llms = `# Would You Rather

> ${ORGANIZATION_DESCRIPTION} Every question can be played free in the browser at ${SITE_URL}, with no account.

${personas
  .map(
    (persona) => `## ${PERSONA_SECTION[persona]}

${SEO_PAGES.filter((p) => p.persona === persona)
  .map((p) => `- [${p.headline}](${loc(`/${p.slug}`)}): ${p.description}`)
  .join('\n')}`,
  )
  .join('\n\n')}

## Optional

- [Full text of every question list](${loc('/llms-full.txt')})
- [All categories](${loc('/categories')})
`;

const unCap = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const llmsFull = `# Would You Rather: full question lists

> ${ORGANIZATION_DESCRIPTION}

${SEO_PAGES.map((p) => {
  const qs = getSeoPageQuestions(p);
  return [
    `## ${p.headline}`,
    '',
    `URL: ${loc(`/${p.slug}`)}`,
    `Last updated: ${getSeoPageUpdated(p)}`,
    p.ages ? `Ages: ${p.ages.min}–${p.ages.max}` : undefined,
    '',
    p.answerQuestion && p.answer ? `**${p.answerQuestion}** ${p.answer}` : p.description,
    '',
    ...qs.map((q, i) => `${i + 1}. Would you rather ${unCap(q.optionA)} or ${unCap(q.optionB)}?`),
    ...(p.faq?.length ? ['', ...p.faq.map((f) => `**${f.q}** ${f.a}`)] : []),
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}).join('\n\n')}
`;

writeFileSync(resolve(process.cwd(), 'public/llms.txt'), llms, 'utf-8');
writeFileSync(resolve(process.cwd(), 'public/llms-full.txt'), llmsFull, 'utf-8');
writeFileSync(resolve(process.cwd(), 'public/sitemap.xml'), xml, 'utf-8');
writeFileSync(resolve(process.cwd(), 'public/robots.txt'), robots, 'utf-8');
console.log(`Sitemap: ${entries.length} URLs on ${new URL(SITE_URL).host} (lastmod ${CONTENT ?? 'omitted'}); robots.txt, llms.txt, llms-full.txt written.`);
