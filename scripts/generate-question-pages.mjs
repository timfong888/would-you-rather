/**
 * Generates the indexed, read-only question pages dist/q/<id>.html for the first batch (lib/seoBatch.js),
 * docs/specs/seo-question-pages.md (#206). Runs in `npm run build:web` after generate-sharing-pages.mjs.
 * vercel.json rewrites /q/:id to /q/:id.html.
 */
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { CANONICAL_ORIGIN } = await import('../lib/site.js');
const { QUESTIONS, CATEGORIES } = await import('../api/_lib/data.js');
const { SEO_QUESTION_PAGES } = await import('../lib/seoBatch.js');
const { questionPageHtml, relatedQuestions } = await import('../lib/questionPage.js');

const ORIGIN = (process.env.EXPO_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, '');
if (process.env.VERCEL_ENV === 'production' && ORIGIN !== CANONICAL_ORIGIN) {
  console.error(`generate-question-pages: production build with EXPO_PUBLIC_SITE_URL="${ORIGIN}", expected "${CANONICAL_ORIGIN}".`);
  process.exit(1);
}
const OUT = join(__dirname, '../dist/q');
await mkdir(OUT, { recursive: true });
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
let count = 0;
for (const id of SEO_QUESTION_PAGES) {
  const question = byId.get(id);
  if (!question) {
    console.error(`generate-question-pages: batch id ${id} is not a question`);
    process.exit(1);
  }
  const category = CATEGORIES.find((c) => c.id === question.category);
  const html = questionPageHtml({ question, category, related: relatedQuestions(question, QUESTIONS), origin: ORIGIN });
  await writeFile(join(OUT, `${id}.html`), html);
  count++;
}
console.log(`Generated ${count} read-only question pages in dist/q/`);
