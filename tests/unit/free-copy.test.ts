import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { COPY } from '../../constants/copy';
import { SEO } from '../../constants/config';
import { randomPlayCategories, pickNextCategory } from '../../lib/nextCategory';
import { CATEGORIES, FREE_QUESTION_COUNT, getCategoryQuestions, getFreeQuestionCount, getLockedQuestionCount } from '../../constants/questions';

const adult = CATEGORIES.filter((c) => c.audience === 'adult');

/** Source without comments, so only strings and code are checked. */
const code = (path: string) =>
  readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('copy is derived from the counts: one hint pattern for every grown-up category', () => {
  assert.equal(COPY.freeMoreHint(5, 15), '5 free · 15 more');
  assert.equal(COPY.freeMoreHint(5, 35), '5 free · 35 more');
  assert.equal(COPY.freePill(5), '5 FREE');
  assert.match(COPY.freeBanner(FREE_QUESTION_COUNT), /5 free questions/);
  for (const c of adult) {
    assert.equal(
      COPY.freeMoreHint(getFreeQuestionCount(c), getLockedQuestionCount(c)),
      `5 free · ${getCategoryQuestions(c.id).length - 5} more`,
      c.id,
    );
  }
});

test('the home and category list screens have no PREMIUM or EXPANSION wording and no bare FREE pill', () => {
  for (const f of ['app/index.tsx', 'app/categories/index.tsx', 'constants/config.ts']) {
    const src = code(f);
    assert.doesNotMatch(src, /PREMIUM|EXPANSION|[Ee]xpansion pack/, f);
    assert.doesNotMatch(src, />\s*FREE\s*</, `${f} has a bare FREE label`);
    assert.doesNotMatch(src, /🔓 FREE|✓ FREE/, f);
  }
  assert.doesNotMatch(SEO.defaultDescription, /expansion/i);
});

test('the unused CategoryCard is gone, and the home stats no longer count free categories', () => {
  assert.equal(existsSync('components/CategoryCard.tsx'), false);
  assert.doesNotMatch(code('app/index.tsx'), /label: 'Free'/);
});

test('random play and next category cover every grown-up category, none skipped', () => {
  assert.equal(randomPlayCategories(CATEGORIES).length, adult.length);
  assert.ok(randomPlayCategories(CATEGORIES).every((c) => c.audience === 'adult'));
  const ids = adult.map((c) => c.id);
  for (let i = 0; i < ids.length; i++) assert.equal(pickNextCategory(CATEGORIES, ids[i])?.id, ids[(i + 1) % ids.length], ids[i]);
});
