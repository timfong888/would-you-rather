// The kids and teen categories (Unit 1 of #124, docs/specs/kids-family-categories.md §2.2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CATEGORIES,
  QUESTIONS,
  getCategoryAudience,
  getCategoryById,
  getCategoryQuestions,
  getFreeQuestionCount,
  getLockedQuestionCount,
  getQuestionById,
  isQuestionLocked,
} from '../../constants/questions';
import { SEO_PAGES, getSeoPageQuestions } from '../../constants/seoPages';
import { isKidsPath } from '../../lib/kidsPaths';
import { randomPlayCategories } from '../../lib/nextCategory';

const EXPECTED: Record<string, { ages: [number, number]; audience: string; written: number; emoji: string }> = {
  'tiny-choices': { ages: [3, 5], audience: 'kids', written: 30, emoji: '🐣' },
  'make-believe': { ages: [4, 8], audience: 'kids', written: 41, emoji: '🏰' },
  'giggle-factory': { ages: [5, 10], audience: 'kids', written: 55, emoji: '😂' },
  'road-trip-rally': { ages: [4, 12], audience: 'kids', written: 30, emoji: '🚗' },
  'dinner-table': { ages: [6, 12], audience: 'kids', written: 47, emoji: '🍽️' },
  'heart-to-heart': { ages: [7, 12], audience: 'kids', written: 30, emoji: '💛' },
  'future-me': { ages: [11, 17], audience: 'kids', written: 30, emoji: '🚀' },
  'real-talk': { ages: [13, 17], audience: 'teen', written: 30, emoji: '💬' },
  'holiday-table': { ages: [4, 12], audience: 'kids', written: 33, emoji: '🎄' },
};
const young = CATEGORIES.filter((c) => c.audience !== 'adult');

test('the 9 categories exist with their ages, audience and emoji, and kids-family is gone', () => {
  assert.deepEqual(young.map((c) => c.id).sort(), Object.keys(EXPECTED).sort());
  for (const [id, e] of Object.entries(EXPECTED)) {
    const c = getCategoryById(id as any)!;
    assert.deepEqual([...c.ages], e.ages, id);
    assert.equal(c.audience, e.audience, id);
    assert.equal(c.emoji, e.emoji, id);
  }
  assert.equal(getCategoryById('kids-family' as any), undefined);
  assert.equal(QUESTIONS.some((q) => (q.category as string) === 'kids-family'), false);
});

test('326 written, 72 free, 254 paid; every category has 8 free questions listed first', () => {
  let written = 0, free = 0, paid = 0;
  for (const c of young) {
    const qs = getCategoryQuestions(c.id);
    assert.equal(qs.length, EXPECTED[c.id].written, `${c.id} written`);
    assert.equal(getFreeQuestionCount(c), 8, `${c.id} free`);
    qs.forEach((q, i) => assert.equal((q.volume ?? 1) === 1, i < 8, `${q.id} at ${i} in ${c.id}`));
    qs.forEach((q, i) => assert.equal(isQuestionLocked(c, i, false), i >= 8));
    assert.equal(getLockedQuestionCount(c), qs.length - 8);
    written += qs.length; free += getFreeQuestionCount(c); paid += getLockedQuestionCount(c);
  }
  assert.deepEqual([written, free, paid], [326, 72, 254]);
});

test('ids: the 223 existing ids are all still there; 73 new kf- and 30 tn- ids are added', () => {
  for (let n = 1; n <= 296; n++) assert.ok(getQuestionById(`kf-${n}`), `kf-${n}`);
  for (let n = 1; n <= 30; n++) assert.ok(getQuestionById(`tn-${n}`), `tn-${n}`);
  assert.equal(getQuestionById('kf-297'), undefined);
  assert.equal(QUESTIONS.filter((q) => q.id.startsWith('kf-')).length, 296);
  assert.equal(QUESTIONS.filter((q) => q.id.startsWith('tn-')).length, 30);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
});

test('every kids and teen question belongs to exactly one category, and tn- is only in the teen category', () => {
  for (const q of QUESTIONS.filter((x) => /^(kf|tn)-/.test(x.id))) {
    assert.equal(CATEGORIES.filter((c) => c.id === q.category).length, 1, q.id);
    const a = getCategoryAudience(q.category);
    assert.equal(a, q.id.startsWith('tn-') ? 'teen' : 'kids', q.id);
  }
});

test('the retag rule (spec §2.2) put the existing questions where it says', () => {
  const where = (n: number) => getQuestionById(`kf-${n}`)!.category;
  assert.equal(where(46), 'tiny-choices');
  assert.equal(where(1), 'make-believe');
  assert.equal(where(214), 'make-believe');
  assert.equal(where(66), 'make-believe');
  assert.equal(where(26), 'giggle-factory');
  assert.equal(where(86), 'giggle-factory');
  assert.equal(where(101), 'giggle-factory');
  assert.equal(where(194), 'road-trip-rally');
  assert.equal(where(154), 'dinner-table');
  assert.equal(where(174), 'dinner-table');
  assert.equal(where(67), 'dinner-table');
  for (const n of [178, 188, 189]) assert.equal(where(n), 'heart-to-heart');
  for (const n of [68, 71, 81, 83]) assert.equal(where(n), 'future-me');
  assert.equal(where(121), 'holiday-table');
  assert.equal(where(136), 'holiday-table');
});

test('every kids route is a kids route, Real Talk is not, and a stale kids-family link stays one', () => {
  for (const c of young) assert.equal(isKidsPath(`/categories/${c.id}`), c.audience === 'kids', c.id);
  assert.equal(isKidsPath('/categories/kids-family'), true);
  assert.equal(isKidsPath('/unlock/kids-family'), true);
  assert.equal(isKidsPath('/game/kf-250'), true);
  assert.equal(isKidsPath('/game/tn-3'), false);
});

test('/categories/kids-family redirects, on the web (vercel.json) and in the app', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(
    vercel.redirects.filter((r: any) => r.source === '/categories/kids-family'),
    [{ source: '/categories/kids-family', destination: '/kids', permanent: true }],
  );
  const screen = readFileSync('app/categories/[id].tsx', 'utf8');
  assert.match(screen, /RETIRED_KIDS_CATEGORY_IDS\.includes\(id\)/);
  assert.match(screen, /<Redirect href="\/kids" \/>/);
});

test('the other retired routes redirect too: /unlock/kids-family reaches a live kids unlock (the gate), /complete/kids-family the list', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const to = (src: string) => vercel.redirects.find((r: any) => r.source === src)?.destination;
  assert.equal(to('/complete/kids-family'), '/kids');
  const unlockTarget = to('/unlock/kids-family');
  assert.equal(unlockTarget, '/unlock/tiny-choices');
  const id = unlockTarget.split('/').pop() as string;
  assert.equal(getCategoryAudience(id), 'kids'); // a live kids category, so App Review still sees the gate
  assert.match(readFileSync('app/unlock/kids-family.tsx', 'utf8'), /<Redirect href="\/unlock\/tiny-choices" \/>/);
  assert.match(readFileSync('app/complete/kids-family.tsx', 'utf8'), /<Redirect href="\/kids" \/>/);
});

test('the home random button draws from adult categories only', () => {
  const pool = randomPlayCategories(CATEGORIES);
  assert.ok(pool.length >= 3);
  for (const c of pool) assert.equal(c.audience, 'adult', c.id);
  assert.equal(pool.length, CATEGORIES.filter((c) => c.audience === 'adult').length, 'every grown-up category, free questions in each (#238)');
  const home = readFileSync('app/index.tsx', 'utf8');
  assert.match(home, /randomPlayCategories\(GROWNUP_CATEGORIES\)/);
  assert.match(home, /GROWNUP_CATEGORIES = categoriesForMode\('grownups', CATEGORIES\)/);
});

test('D4: every kids landing page lists its full set (free or not) from kids categories only', () => {
  const kidsPages = SEO_PAGES.filter((p) => p.questionTag);
  assert.equal(kidsPages.length, 12);
  let locked = 0;
  for (const page of kidsPages) {
    const qs = getSeoPageQuestions(page);
    assert.ok(qs.length >= 10, `${page.slug} lists ${qs.length}`);
    for (const q of qs) {
      assert.equal(getCategoryAudience(q.category), 'kids', `${page.slug} lists ${q.id}`);
      assert.ok(q.tags?.includes(page.questionTag!));
      const c = getCategoryById(q.category)!;
      if (isQuestionLocked(c, getCategoryQuestions(c.id).indexOf(q), false)) locked++;
    }
  }
  assert.ok(locked > 0, 'some listed questions are paid in the app, and the pages still list them (D4)');
});

test('SEO pages keep their question counts (the pages are indexed)', () => {
  const counts = Object.fromEntries(SEO_PAGES.filter((p) => p.questionTag).map((p) => [p.questionTag, getSeoPageQuestions(p).length]));
  assert.deepEqual(counts, {
    kids: 25, funny: 20, little: 20, elementary: 20, 'this-or-that': 20, gross: 15,
    thanksgiving: 15, christmas: 18, family: 20, dinner: 20, 'road-trip': 20, app: 10,
  });
});
