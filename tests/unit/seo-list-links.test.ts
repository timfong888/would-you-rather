import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { questionPageUrl } from '../../lib/seoLinks';
import { SEO_QUESTION_PAGES } from '../../lib/seoBatch.js';
import { SEO_PAGES, getSeoPageQuestions, isKidsPage } from '../../constants/seoPages';
import { SITE_URL } from '../../constants/config';
import { isKidsCategoryId } from '../../constants/questions';

const read = (p: string) => readFileSync(join(__dirname, '../..', p), 'utf8');

test('a question with a read-only page links to its absolute /q URL', () => {
  for (const id of SEO_QUESTION_PAGES) assert.equal(questionPageUrl(id), `${SITE_URL}/q/${id}`);
});

test('a question without a page returns null, so the list keeps today\'s target', () => {
  assert.equal(questionPageUrl('ms-1'), null);
  assert.equal(questionPageUrl('not-a-question'), null);
});

test('landing pages: the /q link is web-only and both links keep seo_question_clicked', () => {
  const src = read('components/SeoLandingPage.tsx');
  assert.match(src, /Platform\.OS === 'web' && questionPageUrl\(q\.id\)/);
  assert.equal(src.split("track('seo_question_clicked'").length - 1, 2);
  assert.match(src, /target: 'q'/);
});

test('category page: web rows link to /q for batch ids; the app keeps blurred locked rows', () => {
  const src = read('app/categories/[id].tsx');
  assert.match(src, /Platform\.OS === 'web' \? questionPageUrl\(q\.id\) : null/);
  assert.match(src, /const showText = !isLocked \|\| pageUrl !== null/);
});

test('kids landing pages only link /q pages of kids-bank questions', () => {
  for (const page of SEO_PAGES.filter(isKidsPage)) {
    for (const q of getSeoPageQuestions(page)) {
      if (questionPageUrl(q.id)) assert.ok(isKidsCategoryId(q.category), `${page.slug}/${q.id} is not a kids question`);
    }
  }
});
