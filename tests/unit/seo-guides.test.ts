// Pillar guides (issue #211, docs/specs/seo-question-pages.md): acceptance tests A1 to A3 and A6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, QUESTIONS } from '../../constants/questions';
import { SEO_PAGES, isKidsPage } from '../../constants/seoPages';
import { SEO_FIRST_BATCH, isSeoBatchId } from '../../lib/seoBatch';
import { GUIDES, guideQuestionIds } from '../../lib/guides';
import { guidePageHtml } from '../../lib/guidePage';

const ORIGIN = 'https://www.wouldyourather.fyi';
const questionsById = new Map(QUESTIONS.map((q) => [q.id, q]));
const categoriesById = new Map(CATEGORIES.map((c) => [c.id, c]));
const landingTitles = new Map(SEO_PAGES.map((p) => [p.slug, p.headline]));
const render = (g: (typeof GUIDES)[number]) => guidePageHtml({ guide: g, questionsById, categoriesById, landingTitles, origin: ORIGIN });

test('A1: every guide lists 15 to 25 distinct real questions, all with a read-only question page', () => {
  assert.ok(GUIDES.length >= 1);
  assert.equal(new Set(GUIDES.map((g) => g.slug)).size, GUIDES.length);
  for (const g of GUIDES) {
    const ids = guideQuestionIds(g);
    assert.ok(ids.length >= 15 && ids.length <= 25, `${g.slug} lists ${ids.length}`);
    assert.equal(new Set(ids).size, ids.length, `${g.slug} repeats a question`);
    for (const id of ids) {
      assert.ok(questionsById.has(id), `${g.slug}: ${id} is not a question`);
      assert.ok(isSeoBatchId(id), `${g.slug}: ${id} is not in the first SEO batch`);
    }
    assert.ok(g.title.length <= 70 && g.description.length <= 160, `${g.slug} title or description too long`);
  }
  assert.ok(SEO_FIRST_BATCH.length > 0);
});

test('A2: a guide is read-only, canonical to itself, one h1, links to every question page, two categories, the hub and a landing page', () => {
  for (const g of GUIDES) {
    const html = render(g);
    assert.ok(html.includes(`<link rel="canonical" href="${ORIGIN}/guides/${g.slug}" />`), g.slug);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, g.slug);
    assert.equal(/<script(?![^>]*application\/ld\+json)/i.test(html), false, `${g.slug} has a script`);
    assert.equal(/<(button|form|input|select|textarea)\b/i.test(html), false, `${g.slug} has a control`);
    for (const id of guideQuestionIds(g)) assert.ok(html.includes(`href="${ORIGIN}/q/${id}"`), `${g.slug} -> /q/${id}`);
    assert.ok((html.match(/href="[^"]*\/categories\//g) ?? []).length >= 2, `${g.slug} links to at least 2 categories`);
    assert.ok(html.includes(`href="${ORIGIN}/kids"`) || html.includes(`href="${ORIGIN}/"`), `${g.slug} links to the hub`);
    assert.ok((g.landing ?? []).length >= 2);
    for (const slug of g.landing) {
      assert.ok(SEO_PAGES.some((p) => p.slug === slug), `${g.slug}: landing ${slug} does not exist`);
      assert.ok(html.includes(`href="${ORIGIN}/${slug}"`), `${g.slug} -> /${slug}`);
    }
  }
});

test('A2 (other guides): with more than one guide, each links to at least 2 others of its kind', () => {
  for (const g of GUIDES) {
    const others = GUIDES.filter((x) => x.slug !== g.slug && x.kids === g.kids);
    if (GUIDES.length < 3) continue;
    const html = render(g);
    assert.ok(others.filter((o) => html.includes(`href="${ORIGIN}/guides/${o.slug}"`)).length >= Math.min(2, others.length), g.slug);
  }
});

test('A3: a kids guide links only to kids destinations and carries no analytics', () => {
  const kidsLanding = new Set(SEO_PAGES.filter(isKidsPage).map((p) => p.slug));
  for (const g of GUIDES.filter((x) => x.kids)) {
    const html = render(g);
    for (const m of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
      if (!m[1].startsWith(ORIGIN)) continue;
      const path = m[1].slice(ORIGIN.length) || '/';
      const ok = path === '/kids' || path.startsWith('/q/') || path.startsWith('/categories/') || path.startsWith('/guides/') || kidsLanding.has(path.slice(1));
      assert.ok(ok, `${g.slug} links to ${path}`);
    }
    for (const id of guideQuestionIds(g)) assert.notEqual(categoriesById.get(questionsById.get(id)!.category)?.audience, 'adult', `${g.slug}: ${id} is an adult question`);
    assert.ok(!html.includes('analytics') && !html.includes('gtag'), g.slug);
  }
});

test('A6: the target keyword is in the title and the h1', () => {
  for (const g of GUIDES) {
    assert.ok(g.title.toLowerCase().includes(g.keyword), `${g.slug} title`);
    assert.ok(g.h1.toLowerCase().includes(g.keyword), `${g.slug} h1`);
  }
});
