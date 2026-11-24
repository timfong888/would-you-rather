// S2 of #206 (docs/specs/seo-question-pages.md): the first batch of indexed, read-only question pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, QUESTIONS, getCategoryQuestions, isQuestionLocked } from '../../constants/questions';
import { SEO_FIRST_BATCH, isSeoBatchId, LANDING_FOR_CATEGORY } from '../../lib/seoBatch';
import { questionPageHtml, relatedQuestions } from '../../lib/questionPage';
import { SEO_PAGES, isKidsPage } from '../../constants/seoPages';

const ORIGIN = 'https://www.wouldyourather.fyi';
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
const catOf = (id: string) => CATEGORIES.find((c) => c.id === byId.get(id)!.category)!;
const page = (id: string) => {
  const q = byId.get(id)!;
  return questionPageHtml({ question: q, category: catOf(id), related: relatedQuestions(q, QUESTIONS), origin: ORIGIN });
};

test('the first batch: about 100 real, distinct, free-tier questions, at most 12 per category, none from the two left-out adult categories', () => {
  assert.ok(SEO_FIRST_BATCH.length >= 95 && SEO_FIRST_BATCH.length <= 110, String(SEO_FIRST_BATCH.length));
  assert.equal(new Set(SEO_FIRST_BATCH).size, SEO_FIRST_BATCH.length);
  const perCat: Record<string, number> = {};
  for (const id of SEO_FIRST_BATCH) {
    const q = byId.get(id);
    assert.ok(q, `${id} is not a question`);
    perCat[q.category] = (perCat[q.category] ?? 0) + 1;
    const c = catOf(id);
    const i = getCategoryQuestions(c.id).findIndex((x) => x.id === id);
    assert.equal(isQuestionLocked(c, i, false), false, `${id} must be a free question today`);
    assert.ok(!['midnight-secrets', 'deep-desires'].includes(q.category), id);
  }
  for (const [c, n] of Object.entries(perCat)) assert.ok(n <= 12, `${c} has ${n}`);
  for (const c of CATEGORIES.filter((x) => x.audience !== 'adult')) assert.ok((perCat[c.id] ?? 0) >= 8, `${c.id} is represented`);
  assert.ok(isSeoBatchId(SEO_FIRST_BATCH[0]) && !isSeoBatchId('hl-20-not-in-batch'));
});

test('every question page is read-only: no script but JSON-LD, no form or vote control, canonical to itself, one link into the playable app', () => {
  for (const id of SEO_FIRST_BATCH) {
    const html = page(id);
    assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}/q/${id}" />`), id);
    assert.equal(/<script(?![^>]*application\/ld\+json)/i.test(html), false, `${id} has a script`);
    assert.equal(/<(button|form|input|select|textarea)\b/i.test(html), false, `${id} has a control`);
    assert.ok(html.includes(`href="${ORIGIN}/game/${id}?cat=`), `${id} links to the playable app`);
    assert.ok(html.includes('index, follow'), id);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, id);
    const q = byId.get(id)!;
    assert.ok(html.includes(q.optionA.replace(/&/g, '&amp;').replace(/"/g, '&quot;')), `${id} shows option A`);
  }
});

test('related questions have /q pages themselves, never repeat the question, and a kids page only relates to kids questions', () => {
  for (const id of SEO_FIRST_BATCH) {
    const q = byId.get(id)!;
    const rel = relatedQuestions(q, QUESTIONS);
    assert.ok(rel.length >= 1 && rel.length <= 5, id);
    for (const r of rel) {
      assert.ok(isSeoBatchId(r.id) && r.id !== id, `${id} -> ${r.id}`);
      if (catOf(id).audience !== 'adult') assert.notEqual(catOf(r.id).audience, 'adult', `${id} -> ${r.id}`);
    }
  }
});

test('a kids question page links only to kids destinations (kids hub, kids category pages, kids landing pages, the playable app, other question pages)', () => {
  const kidsSlugs = new Set(SEO_PAGES.filter(isKidsPage).map((p) => `/${p.slug}`));
  for (const id of SEO_FIRST_BATCH.filter((x) => catOf(x).audience !== 'adult')) {
    const html = page(id);
    for (const m of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
      if (!m[1].startsWith(ORIGIN)) continue;
      const path = m[1].slice(ORIGIN.length) || '/';
      const ok = path === '/kids' || path.startsWith('/game/') || path.startsWith('/q/') || path.startsWith('/categories/') || kidsSlugs.has(path);
      assert.ok(ok, `${id} links to ${path}`);
    }
    assert.ok(!html.includes('analytics') && !html.includes('gtag'), id);
  }
});

test('the landing page each category links to exists, and kids categories only map to kids pages', () => {
  for (const [cat, slug] of Object.entries(LANDING_FOR_CATEGORY)) {
    const p = SEO_PAGES.find((x) => x.slug === slug);
    assert.ok(p, `${cat} -> ${slug}`);
    if (CATEGORIES.find((c) => c.id === cat)!.audience !== 'adult') assert.ok(isKidsPage(p!), `${cat} -> ${slug} must be a kids page`);
  }
});

test('vercel.json sends a canonical Link header on /game/<id> for every batch question (crawlers get it without running scripts)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = JSON.parse(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const bySource = new Map(config.headers.map((h) => [h.source, h.headers.find((x) => x.key === 'Link')?.value]));
  for (const id of SEO_FIRST_BATCH) assert.equal(bySource.get(`/game/${id}`), `<${ORIGIN}/q/${id}>; rel="canonical"`, id);
  const extra = config.headers.filter((h) => /^\/game\/[^/:]+$/.test(h.source) && !isSeoBatchId(h.source.slice(6)));
  assert.deepEqual(extra, [], 'a /game/<id> canonical header for a question outside the batch (run node scripts/sync-vercel-canonicals.mjs)');
});
