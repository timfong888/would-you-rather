/**
 * Generates the pillar guide pages dist/guides/<slug>.html (lib/guides.js), issue #211.
 * Runs in `npm run build:web` after generate-question-pages.mjs. vercel.json rewrites /guides/:slug to /guides/:slug.html.
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { CANONICAL_ORIGIN } = await import('../lib/site.js');
const { QUESTIONS, CATEGORIES } = await import('../api/_lib/data.js');
const { GUIDES, guideQuestionIds } = await import('../lib/guides.js');
const { isSeoBatchId } = await import('../lib/seoBatch.js');
const { guidePageHtml } = await import('../lib/guidePage.js');

const ORIGIN = (process.env.EXPO_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, '');
if (process.env.VERCEL_ENV === 'production' && ORIGIN !== CANONICAL_ORIGIN) {
  console.error(`generate-guide-pages: production build with EXPO_PUBLIC_SITE_URL="${ORIGIN}", expected "${CANONICAL_ORIGIN}".`);
  process.exit(1);
}
const questionsById = new Map(QUESTIONS.map((q) => [q.id, q]));
const categoriesById = new Map(CATEGORIES.map((c) => [c.id, c]));
// Landing page titles come from the one place they live (constants/seoPages.ts is TypeScript), so read them from the sitemap data:
// the link text is the slug turned into words, which keeps this script plain JS.
const landingTitles = new Map();
const words = (slug) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
for (const g of GUIDES) for (const slug of g.landing) landingTitles.set(slug, words(slug));

const OUT = join(__dirname, '../dist/guides');
await mkdir(OUT, { recursive: true });
for (const guide of GUIDES) {
  for (const id of guideQuestionIds(guide)) {
    if (!questionsById.has(id) || !isSeoBatchId(id)) {
      console.error(`generate-guide-pages: ${guide.slug} lists ${id}, which is not a question in the first SEO batch`);
      process.exit(1);
    }
  }
  await writeFile(join(OUT, `${guide.slug}.html`), guidePageHtml({ guide, questionsById, categoriesById, landingTitles, origin: ORIGIN }));
}
console.log(`Generated ${GUIDES.length} guide page(s) in dist/guides/`);
