import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextCategory } from '../../lib/nextCategory';

const cats = [
  { id: 'a', audience: 'adult' as const },
  { id: 'b', audience: 'adult' as const },
  { id: 'c', audience: 'adult' as const },
  { id: 'kids-family', audience: 'kids' as const },
  { id: 'a-teen-one', audience: 'teen' as const },
  { id: 'd', audience: 'adult' as const },
];

test('picks the next adult category in order: every one has free questions, none is skipped', () => {
  assert.equal(pickNextCategory(cats, 'a')?.id, 'b');
  assert.equal(pickNextCategory(cats, 'b')?.id, 'c');
});
test('wraps around the list', () => {
  assert.equal(pickNextCategory(cats, 'd')?.id, 'a');
});
test('never sends an adult player into kids, or a kids player into adult categories', () => {
  assert.equal(pickNextCategory(cats, 'c')?.id, 'd');
  assert.equal(pickNextCategory(cats, 'kids-family'), null);
});
test('a teen category is not an adult category: never suggested after an adult one, and no suggestion after it', () => {
  assert.equal(pickNextCategory(cats, 'c')?.id, 'd'); // skips the kids and the teen category
  assert.equal(pickNextCategory(cats, 'a-teen-one'), null);
});
test('unknown category or no other adult category gives null', () => {
  assert.equal(pickNextCategory(cats, 'zzz'), null);
  assert.equal(pickNextCategory([{ id: 'a', audience: 'adult' }, { id: 'k', audience: 'kids' }], 'a'), null);
});
