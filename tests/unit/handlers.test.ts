// The two HTTP handlers end to end (Request in, Response out), against the
// in-memory store that `WYR_VOTE_STORE=memory` selects for local development.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS
import votes from '../../api/votes.js';
// @ts-ignore plain JS
import tallies from '../../api/tallies.js';

const V1 = '00000000-0000-4000-8000-000000000001';
const post = (body: unknown, headers: Record<string, string> = {}) =>
  votes(new Request('https://x.test/api/votes', { method: 'POST', body: JSON.stringify(body), headers }));

before(() => {
  process.env.WYR_VOTE_STORE = 'memory';
  delete process.env.DATABASE_URL;
});

test('POST /api/votes stores a vote, GET /api/tallies returns the real count with cache headers', async () => {
  const res = await post({ questionId: 'hl-1', choice: 'B', visitorId: V1 }, { 'x-vercel-ip-country': 'US' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { counted: true, choice: 'B', tally: { a: 0, b: 1 } });

  const get = await tallies(new Request('https://x.test/api/tallies?ids=hl-1,hl-2'));
  assert.equal(get.status, 200);
  assert.match(get.headers.get('cache-control')!, /s-maxage=60/);
  assert.deepEqual(await get.json(), { 'hl-1': { a: 0, b: 1 }, 'hl-2': { a: 0, b: 0 } });
});

test('a repeat vote from the same device answers 200 and is not counted again', async () => {
  const res = await post({ questionId: 'hl-1', choice: 'A', visitorId: V1 });
  assert.equal(res.status, 200);
  // sent A this time; the first vote (B) is what the server holds and reports
  assert.deepEqual(await res.json(), { counted: false, choice: 'B', tally: { a: 0, b: 1 } });
});

test('bad requests: wrong method 405, bad body 400, bad ids 400, oversized body 400', async () => {
  assert.equal((await votes(new Request('https://x.test/api/votes'))).status, 405);
  assert.equal((await post({ questionId: 'hl-1', choice: 'Z', visitorId: V1 })).status, 400);
  assert.equal((await votes(new Request('https://x.test/api/votes', { method: 'POST', body: '{nope' }))).status, 400);
  assert.equal((await votes(new Request('https://x.test/api/votes', { method: 'POST', body: JSON.stringify({ pad: 'x'.repeat(3000) }) }))).status, 400);
  assert.equal((await tallies(new Request('https://x.test/api/tallies'))).status, 400);
});

test('kids votes work through the handler when the secret is set, and fail closed when not', async () => {
  delete process.env.VOTER_KEY_SECRET;
  assert.equal((await post({ questionId: 'kf-1', choice: 'A', visitorId: V1 })).status, 503);
  process.env.VOTER_KEY_SECRET = 'test-secret';
  assert.equal((await post({ questionId: 'kf-1', choice: 'A', visitorId: V1 })).status, 201);
  delete process.env.VOTER_KEY_SECRET;
});

test('with no storage configured both endpoints answer 503, never an error page', async () => {
  delete process.env.WYR_VOTE_STORE;
  const v = await post({ questionId: 'hl-1', choice: 'A', visitorId: V1 });
  assert.equal(v.status, 503);
  assert.deepEqual(await v.json(), { error: 'unavailable', retryable: true });
  const t = await tallies(new Request('https://x.test/api/tallies?ids=hl-1'));
  assert.equal(t.status, 503);
  assert.equal(t.headers.get('cache-control'), 'no-store');
  process.env.WYR_VOTE_STORE = 'memory';
});
