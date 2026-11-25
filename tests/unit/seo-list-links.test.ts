import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { questionPageUrl } from '../../lib/seoLinks';
import { SEO_QUESTION_PAGES } from '../../lib/seoBatch.js';
import { SEO_PAGES, getSeoPageQuestions } from '../../constants/seoPages';
import { SITE_URL } from '../../constants/config';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('a question with a read-only page links to its absolute /q URL', () => {
  for (const id of SEO_QUESTION_PAGES) assert.equal(questionPageUrl(id), `${SITE_URL}/q/${id}`);
});

test('a question without a page returns null, so the list keeps today\'s target', () => {
  assert.equal(questionPageUrl('ms-1'), null);
  assert.equal(questionPageUrl('not-a-question'), null);
});

test('landing pages: "Play this one" only remains for questions without a page', () => {
  const src = read('components/SeoLandingPage.tsx');
  assert.match(src, /questionPageUrl\(q\.id\)/);
  assert.match(src, /See this question/);
  // The only "Play this one" is the fallback branch of the questionPageUrl conditional.
  assert.equal(src.split('Play this one').length - 1, 1);
  assert.ok(src.indexOf('See this question') < src.indexOf('Play this one'));
});

test('category page: web rows link to /q for batch ids; the app keeps blurred locked rows', () => {
  const src = read('app/categories/[id].tsx');
  assert.match(src, /Platform\.OS === 'web' \? questionPageUrl\(q\.id\) : null/);
  assert.match(src, /const showText = !isLocked \|\| pageUrl !== null/);
  assert.match(src, /<Link href=\{pageUrl as never\}/);
});

test('every landing page question is listed with either a /q link or a playable fallback', () => {
  for (const page of SEO_PAGES) {
    for (const q of getSeoPageQuestions(page)) {
      const url = questionPageUrl(q.id);
      assert.ok(url === null || SEO_QUESTION_PAGES.includes(q.id), `${page.slug}/${q.id}`);
    }
  }
});
