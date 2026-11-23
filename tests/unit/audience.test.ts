// The kids rule is derived from `audience` (docs/specs/kids-family-categories.md §2.3). These tests fail if a
// kids category is added and any of the places that apply the rule does not pick it up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  FAMILY_FRIENDLY,
  PARENTAL_GATE_CATEGORIES,
  QUESTIONS,
  audienceForAges,
  getCategoryAudience,
  isKidsCategoryId,
} from '../../constants/questions';
import { isKidsPath, isKidsQuestion } from '../../lib/kidsPaths';
import { requiresParentalGate } from '../../lib/parentalGate';
import { propsAreKids } from '../../lib/analyticsCore';
import { SEO_PAGES, getSeoPageQuestions, listsFullWrittenSet } from '../../constants/seoPages';
// @ts-ignore plain JS edge mirror
import { CATEGORIES as MIRROR_CATEGORIES, QUESTIONS as MIRROR_QUESTIONS } from '../../api/_lib/data.js';
// @ts-ignore plain JS
import { indexQuestions, recordVote, memoryStore } from '../../api/_lib/votes.js';

const kidsCategories = CATEGORIES.filter((c) => c.audience === 'kids');

test('every category has an audience and an ages range that agree', () => {
  assert.ok(CATEGORIES.length > 0);
  for (const c of CATEGORIES) {
    assert.ok(['adult', 'kids', 'teen'].includes(c.audience), `${c.id} audience`);
    assert.ok(Number.isInteger(c.ages[0]) && Number.isInteger(c.ages[1]) && c.ages[0] <= c.ages[1], `${c.id} ages`);
    assert.equal(c.audience, audienceForAges(c.ages), `${c.id}: audience must follow the youngest age`);
  }
});

test('audience boundaries: youngest age under 13 is kids, 13 to 17 teen, 18+ adult', () => {
  assert.equal(audienceForAges([3, 5]), 'kids');
  assert.equal(audienceForAges([11, 17]), 'kids'); // starts under 13, so kids rules apply to all of it
  assert.equal(audienceForAges([12, 12]), 'kids');
  assert.equal(audienceForAges([13, 17]), 'teen');
  assert.equal(audienceForAges([17, 17]), 'teen');
  assert.equal(audienceForAges([18, 99]), 'adult');
});

test('every kids category is a kids route: category, complete and unlock', () => {
  assert.ok(kidsCategories.length > 0, 'there is at least one kids category');
  for (const c of kidsCategories) {
    for (const base of ['categories', 'complete', 'unlock']) {
      assert.equal(isKidsPath(`/${base}/${c.id}`), true, `/${base}/${c.id}`);
      assert.equal(isKidsPath(`/${base}/${c.id}/`), true, `/${base}/${c.id}/ (trailing slash)`);
      assert.equal(isKidsPath(`/${base}/${encodeURIComponent(c.id)}`), true, `${base} encoded`);
    }
  }
});

test('teen and adult categories are not kids routes; teen is gated', () => {
  for (const c of CATEGORIES.filter((x) => x.audience !== 'kids')) {
    for (const base of ['categories', 'complete', 'unlock']) assert.equal(isKidsPath(`/${base}/${c.id}`), false, `${c.id}`);
    assert.equal(requiresParentalGate(c.id), c.audience === 'teen', c.id);
  }
});

test('FAMILY_FRIENDLY is the kids audience and the gate list is kids plus teen, both read from audience', () => {
  assert.deepEqual([...FAMILY_FRIENDLY].sort(), kidsCategories.map((c) => c.id).sort());
  assert.deepEqual(
    [...PARENTAL_GATE_CATEGORIES].sort(),
    CATEGORIES.filter((c) => c.audience !== 'adult').map((c) => c.id).sort(),
  );
});

test('under-13 question ids are kf-, and only under-13 questions are', () => {
  for (const q of QUESTIONS) {
    assert.equal(isKidsQuestion(q.id), isKidsCategoryId(q.category), `${q.id} in ${q.category}`);
  }
  for (const q of QUESTIONS.filter((x) => getCategoryAudience(x.category) === 'teen')) {
    assert.match(q.id, /^tn-\d+$/, `teen ids use tn-: ${q.id}`);
  }
});

test('analytics props naming a kids category are kids content; others are not', () => {
  for (const c of kidsCategories) assert.equal(propsAreKids({ category_id: c.id }), true, c.id);
  for (const c of CATEGORIES.filter((x) => x.audience !== 'kids')) assert.equal(propsAreKids({ category_id: c.id }), false, c.id);
  assert.equal(propsAreKids({ category_id: undefined }), false);
  assert.equal(propsAreKids({ question_id: 'kf-1' }), true);
});

test('the edge mirror agrees on audience and ages, so the server treats the same categories as kids', () => {
  const byId = new Map<string, any>(MIRROR_CATEGORIES.map((c: any) => [c.id, c]));
  for (const c of CATEGORIES) {
    assert.equal(byId.get(c.id)?.audience, c.audience, `${c.id} audience`);
    assert.deepEqual(byId.get(c.id)?.ages, [...c.ages], `${c.id} ages`);
  }
});

test('server: a vote on a question in a kids category is stored as a kids vote with no visitor ID', async () => {
  const kidsQuestions = (MIRROR_QUESTIONS as { id: string; category: string }[]).filter((q) => isKidsCategoryId(q.category));
  assert.ok(kidsQuestions.length > 0);
  const store = memoryStore();
  const questionsById = indexQuestions(MIRROR_QUESTIONS);
  const res = await recordVote({ store, questionsById, body: { questionId: kidsQuestions[0].id, choice: 'A' }, geo: { country: null, region: null } });
  assert.equal(res.status, 201);
});

test('D4: kids landing pages list their full written set; adult pages still list free questions only', () => {
  const tagged = SEO_PAGES.filter((p) => p.questionTag);
  assert.ok(tagged.length > 0);
  for (const page of tagged) {
    assert.equal(listsFullWrittenSet(page), true, page.slug);
    const written = QUESTIONS.filter((q) => page.categoryIds.includes(q.category) && q.tags?.includes(page.questionTag!));
    assert.deepEqual(getSeoPageQuestions(page).map((q) => q.id), written.slice(0, page.limit).map((q) => q.id), page.slug);
  }
  for (const page of SEO_PAGES.filter((p) => !p.questionTag)) assert.equal(listsFullWrittenSet(page), false, page.slug);
});
