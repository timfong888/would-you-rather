// Client side of the vote API: what the app does with the server's answers (issue #65).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postVote, getTally, getTallies, queueAfterFlush, reconcileChoice, lockedChoice, parsePending } from '../../lib/votes-core';

const VOTE = { questionId: 'hl-1', choice: 'A' as const, visitorId: '00000000-0000-4000-8000-000000000001' };
const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

test('postVote returns the server tally and sends the vote as JSON', async () => {
  let seen: any;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ counted: true, tally: { a: 3, b: 1 } }), { status: 201 });
  };
  const r = await postVote(fetchImpl, '', VOTE);
  assert.deepEqual(r, { tally: { a: 3, b: 1 }, choice: null, retry: false });
  assert.equal(seen.url, '/api/votes');
  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(JSON.parse(seen.init.body), VOTE);
});

test('an already-counted vote (200) still returns the real tally', async () => {
  const r = await postVote(json(200, { counted: false, choice: 'B', tally: { a: 5, b: 5 } }), '', VOTE);
  // the player tapped A this time, but the server holds B from the first vote
  assert.deepEqual(r, { tally: { a: 5, b: 5 }, choice: 'B', retry: false });
});

test('503, 429 and network failure give no numbers and are retried later; 400 is not', async () => {
  assert.deepEqual(await postVote(json(503, { error: 'unavailable' }), '', VOTE), { tally: null, choice: null, retry: true });
  assert.deepEqual(await postVote(json(429, {}), '', VOTE), { tally: null, choice: null, retry: true });
  assert.deepEqual(await postVote(async () => { throw new Error('offline'); }, '', VOTE), { tally: null, choice: null, retry: true });
  assert.deepEqual(await postVote(json(400, { error: 'invalid' }), '', VOTE), { tally: null, choice: null, retry: false });
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

test('a vote queued while a flush was in flight survives the flush', () => {
  const hl1 = { questionId: 'hl-1', choice: 'A' as const };
  const hl2 = { questionId: 'hl-2', choice: 'B' as const };
  // flush started with [hl-1]; hl-2 was queued during it; hl-1 was still retryable, so nothing is done
  assert.deepEqual(queueAfterFlush([hl1, hl2], []), [hl1, hl2]);
  // hl-1 was sent: only hl-1 leaves the queue
  assert.deepEqual(queueAfterFlush([hl1, hl2], [hl1]), [hl2]);
  // everything sent
  assert.deepEqual(queueAfterFlush([hl1], [hl1]), []);
  // an entry whose choice changed meanwhile is not removed by the older snapshot
  assert.deepEqual(queueAfterFlush([{ questionId: 'hl-1', choice: 'B' }], [hl1]), [{ questionId: 'hl-1', choice: 'B' }]);
});

test('reload regression: re-answering with a different choice keeps the stored first answer', () => {
  // confirm A, reload, tap B: the server answers choice A, and that is what the screen keeps
  assert.equal(reconcileChoice('B', 'A'), 'A');
  // first vote, or the server sent no choice (old server / failure): keep what was tapped
  assert.equal(reconcileChoice('B', 'B'), 'B');
  assert.equal(reconcileChoice('B', null), 'B');
});

test('upgrade regression: an answer saved before votes were stored does not lock the question', () => {
  // The old "answered questions" list is not an input at all: with no acknowledged vote
  // and nothing queued, the player can still vote.
  assert.equal(lockedChoice('hl-1', {}, []), null);
  // a vote the server acknowledged locks, with the server's choice
  assert.equal(lockedChoice('hl-1', { 'hl-1': 'A' }, []), 'A');
  // a vote queued for retry locks too (it will be sent), and acknowledged wins over queued
  assert.equal(lockedChoice('hl-1', {}, [{ questionId: 'hl-1', choice: 'B' }]), 'B');
  assert.equal(lockedChoice('hl-1', { 'hl-1': 'A' }, [{ questionId: 'hl-1', choice: 'B' }]), 'A');
  // other questions are unaffected, and garbage in storage is ignored
  assert.equal(lockedChoice('hl-2', { 'hl-1': 'A' }, []), null);
  assert.equal(lockedChoice('hl-1', { 'hl-1': 'Z' as any }, []), null);
});

test('retry queue: more than 20 pending votes are all kept, nothing is dropped on read', () => {
  const entries = Array.from({ length: 25 }, (_, i) => ({ questionId: `hl-${i + 1}`, choice: i % 2 ? 'A' : 'B' }));
  const read = parsePending(JSON.stringify(entries));
  assert.equal(read.length, 25);
  // a flush that sent the first 20 leaves exactly the other 5 queued
  const left = queueAfterFlush(read, read.slice(0, 20));
  assert.deepEqual(left.map((p) => p.questionId), ['hl-21', 'hl-22', 'hl-23', 'hl-24', 'hl-25']);
});

test('retry queue: bad storage is ignored, one entry per question, latest wins', () => {
  assert.deepEqual(parsePending(null), []);
  assert.deepEqual(parsePending('{nope'), []);
  assert.deepEqual(parsePending('{"a":1}'), []);
  assert.deepEqual(
    parsePending(JSON.stringify([{ questionId: 'hl-1', choice: 'A' }, { questionId: '', choice: 'A' }, { questionId: 'hl-2', choice: 'Z' }, null, { questionId: 'hl-1', choice: 'B' }])),
    [{ questionId: 'hl-1', choice: 'B' }],
  );
});
