// S2 of #206 (docs/specs/seo-question-pages.md): the first batch of indexed, read-only question pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, QUESTIONS, getCategoryQuestions, isQuestionLocked } from '../../constants/questions';
import { SEO_FIRST_BATCH, SEO_BATCH_2, SEO_BATCH_3, SEO_CATEGORY_CTA_IDS, SEO_QUESTION_PAGES, isSeoBatchId, LANDING_FOR_CATEGORY } from '../../lib/seoBatch';
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

test('batch two (a proposal for Tim\'s review): about 60 distinct kids-bank questions, none already in batch one, none adult or teen', () => {
  assert.ok(SEO_BATCH_2.length >= 55 && SEO_BATCH_2.length <= 65, String(SEO_BATCH_2.length));
  assert.equal(new Set(SEO_BATCH_2).size, SEO_BATCH_2.length);
  for (const id of SEO_BATCH_2) {
    assert.ok(byId.has(id), `${id} is not a question`);
    assert.ok(!SEO_FIRST_BATCH.includes(id), `${id} is already in batch one`);
    assert.equal(catOf(id).audience, 'kids', `${id} must be a kids-bank question`);
  }
  assert.equal(new Set(SEO_QUESTION_PAGES).size, SEO_FIRST_BATCH.length + SEO_BATCH_2.length + SEO_BATCH_3.length);
  assert.ok(SEO_BATCH_2.every((id) => isSeoBatchId(id)));
});

test('batch three (S3): every question that is free today and had no page, except Midnight Secrets and Deep Desires', () => {
  assert.equal(new Set(SEO_BATCH_3).size, SEO_BATCH_3.length);
  for (const id of SEO_BATCH_3) {
    assert.ok(byId.has(id), `${id} is not a question`);
    assert.ok(!SEO_FIRST_BATCH.includes(id) && !SEO_BATCH_2.includes(id), `${id} is already in an earlier batch`);
    assert.ok(!['midnight-secrets', 'deep-desires'].includes(byId.get(id)!.category), id);
  }
  // Every question that is free today now has a read-only page (or is one of the two categories left out on purpose), so the
  // sitemap needs no /game/<id> entries and does not depend on the free count.
  for (const c of CATEGORIES) {
    getCategoryQuestions(c.id).forEach((q, i) => {
      if (isQuestionLocked(c, i, false)) return;
      if (['midnight-secrets', 'deep-desires'].includes(c.id)) return;
      assert.ok(isSeoBatchId(q.id), `${q.id} is free today and has no read-only page`);
    });
  }
  assert.deepEqual([...SEO_CATEGORY_CTA_IDS].sort(), [...SEO_BATCH_2, ...SEO_BATCH_3].sort());
});

test('batch-three pages are free questions: the category call to action, but no "extra question in this pack" copy', () => {
  for (const id of SEO_BATCH_3) {
    const q = byId.get(id)!;
    const html3 = questionPageHtml({ question: q, category: catOf(id), related: relatedQuestions(q, QUESTIONS), origin: ORIGIN, categoryCta: true });
    assert.ok(html3.includes(`<a class="cta" href="${ORIGIN}/categories/${q.category}"`), id);
    assert.ok(!html3.includes(`${ORIGIN}/game/${id}`), `${id} must not link straight to its playable screen`);
    assert.ok(!html3.includes('extra questions in this pack'), `${id} is free and must not say it is a paid extra`);
  }
});

test('batch-two pages are for paid questions: their one call to action leads to the category\'s free questions, never to the paywall', () => {
  for (const id of SEO_BATCH_2) {
    const q = byId.get(id)!;
    const html2 = questionPageHtml({ question: q, category: catOf(id), related: relatedQuestions(q, QUESTIONS), origin: ORIGIN, paid: true });
    assert.ok(html2.includes(`href="${ORIGIN}/categories/${q.category}"`), id);
    assert.ok(!html2.includes(`${ORIGIN}/game/${id}`), `${id} must not link straight to its playable screen`);
    assert.ok(/Play the free .* questions/.test(html2), id);
    assert.ok(html2.includes('extra questions in this pack'), `${id} is a paid extra`);
  }
  // Batch one is free-tier: its call to action still plays the question.
  assert.ok(page(SEO_FIRST_BATCH[0]).includes(`${ORIGIN}/game/${SEO_FIRST_BATCH[0]}`));
});

test('every question page is read-only: no script but JSON-LD, no form or vote control, canonical to itself, one link into the playable app', () => {
  for (const id of SEO_QUESTION_PAGES) {
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
  for (const id of SEO_QUESTION_PAGES) {
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
  for (const id of SEO_QUESTION_PAGES.filter((x) => catOf(x).audience !== 'adult')) {
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
  for (const id of SEO_QUESTION_PAGES) assert.equal(bySource.get(`/game/${id}`), `<${ORIGIN}/q/${id}>; rel="canonical"`, id);
  const extra = config.headers.filter((h) => /^\/game\/[^/:]+$/.test(h.source) && !isSeoBatchId(h.source.slice(6)));
  assert.deepEqual(extra, [], 'a /game/<id> canonical header for a question outside the batch (run node scripts/sync-vercel-canonicals.mjs)');
});
