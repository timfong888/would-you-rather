// Client side of the vote API: what the app does with the server's answers (issue #65).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postVote, getTally, getTallies } from '../../lib/votes-core';

const VOTE = { questionId: 'hl-1', choice: 'A' as const, visitorId: '00000000-0000-4000-8000-000000000001' };
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

test('postVote returns the server tally and sends the vote as JSON', async () => {
  let seen: any;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ counted: true, tally: { a: 3, b: 1 } }), { status: 201 });
  };
  const r = await postVote(fetchImpl, '', VOTE);
  assert.deepEqual(r, { tally: { a: 3, b: 1 }, retry: false });
  assert.equal(seen.url, '/api/votes');
  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(JSON.parse(seen.init.body), VOTE);
});

test('an already-counted vote (200) still returns the real tally', async () => {
  const r = await postVote(json(200, { counted: false, tally: { a: 5, b: 5 } }), '', VOTE);
  assert.deepEqual(r, { tally: { a: 5, b: 5 }, retry: false });
});

test('503, 429 and network failure give no numbers and are retried later; 400 is not', async () => {
  assert.deepEqual(await postVote(json(503, { error: 'unavailable' }), '', VOTE), { tally: null, retry: true });
  assert.deepEqual(await postVote(json(429, {}), '', VOTE), { tally: null, retry: true });
  assert.deepEqual(await postVote(async () => { throw new Error('offline'); }, '', VOTE), { tally: null, retry: true });
  assert.deepEqual(await postVote(json(400, { error: 'invalid' }), '', VOTE), { tally: null, retry: false });
});

test('a malformed server answer never becomes a number', async () => {
  assert.equal((await postVote(json(201, { tally: { a: 'x', b: 1 } }), '', VOTE)).tally, null);
  assert.equal((await postVote(json(201, { tally: { a: -3, b: 1 } }), '', VOTE)).tally, null);
  assert.equal((await postVote(json(201, {}), '', VOTE)).tally, null);
});

test('getTally / getTallies return counts, or null on any failure', async () => {
  const body = { 'hl-1': { a: 12, b: 8 }, 'hl-2': { a: 0, b: 0 } };
  assert.deepEqual(await getTally(json(200, body), '', 'hl-1'), { a: 12, b: 8 });
  assert.deepEqual(await getTallies(json(200, body), '', ['hl-1', 'hl-2']), body);
  assert.equal(await getTally(json(503, {}), '', 'hl-1'), null);
  assert.equal(await getTally(async () => { throw new Error('offline'); }, '', 'hl-1'), null);
  assert.equal(await getTallies(json(200, body), '', []), null);
  assert.equal(await getTallies(json(200, body), '', Array.from({ length: 51 }, (_, i) => `hl-${i}`)), null);
});
