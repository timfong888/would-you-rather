import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextCategory } from '../../lib/nextCategory';

const cats = [
  { id: 'a', tier: 'premium' as const },
  { id: 'b', tier: 'free' as const },
  { id: 'c', tier: 'premium' as const },
  { id: 'kids-family', tier: 'free' as const },
  { id: 'd', tier: 'free' as const },
];
const locked = () => false;

test('picks the next free category in order', () => {
  assert.equal(pickNextCategory(cats, 'a', locked)?.id, 'b');
});
test('skips premium categories that are not unlocked, includes unlocked ones', () => {
  assert.equal(pickNextCategory(cats, 'b', locked)?.id, 'd');
  assert.equal(pickNextCategory(cats, 'b', (id) => id === 'c')?.id, 'c');
});
test('wraps around the list', () => {
  assert.equal(pickNextCategory(cats, 'd', locked)?.id, 'b');
});
test('never sends an adult player into kids, or a kids player into adult categories', () => {
  assert.equal(pickNextCategory(cats, 'c', locked)?.id, 'd');
  assert.equal(pickNextCategory(cats, 'kids-family', locked), null);
});
test('unknown category or nothing playable gives null', () => {
  assert.equal(pickNextCategory(cats, 'zzz', locked), null);
  assert.equal(pickNextCategory([{ id: 'a', tier: 'premium' }, { id: 'c', tier: 'premium' }], 'a', locked), null);
});
