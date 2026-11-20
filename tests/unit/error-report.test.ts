import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS
import { recordVote, readTallies, logApiError } from '../../api/_lib/votes.js';
// @ts-ignore plain JS
import votes from '../../api/votes.js';
// @ts-ignore plain JS
import tallies from '../../api/tallies.js';
import { scrub, describeError, createLimiter } from '../../lib/errorReport';

function captureStderr<T>(fn: () => Promise<T>): Promise<{ out: T; lines: string[] }> {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  return fn().then((out) => ({ out, lines })).finally(() => { console.error = orig; });
}

test('scrub drops query strings and emails and truncates', () => {
  assert.equal(scrub('failed https://www.wouldyourather.fyi/p/hl-1?link_id=abc&x=1#frag now'), 'failed https://www.wouldyourather.fyi/p/hl-1 now');
  assert.equal(scrub('mail me at kid@example.com please'), 'mail me at <email> please');
  assert.equal(scrub('x'.repeat(500)).length, 200);
});

test('describeError handles Error, string, object and unserialisable values', () => {
  assert.deepEqual(describeError(new TypeError('boom')), { type: 'TypeError', message: 'boom' });
  assert.deepEqual(describeError('plain'), { type: 'Error', message: 'plain' });
  assert.equal(describeError({ a: 1 }).message, '{"a":1}');
  const cyclic: any = {}; cyclic.self = cyclic;
  assert.equal(describeError(cyclic).type, 'Error');
});

test('limiter caps repeats of one error and the total per page load', () => {
  const allow = createLimiter(3, 2);
  assert.deepEqual([allow('a'), allow('a'), allow('a'), allow('b'), allow('c'), allow('d')], [true, true, false, true, false, false]);
});

test('a store failure on POST /api/votes logs one api_error line with route and reason, and no ids or connection strings', async () => {
  const store = { insertVote: async () => { throw new Error('connect failed postgres://user:secret@host/db'); } };
  const questionsById = new Map([['hl-1', { id: 'hl-1', category: 'high-life' }]]);
  const { out, lines } = await captureStderr(() =>
    recordVote({ store, questionsById, body: { questionId: 'hl-1', choice: 'A', visitorId: '00000000-0000-4000-8000-000000000009' }, geo: {} }),
  );
  assert.equal(out.status, 503);
  assert.equal(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  assert.equal(rec.event, 'api_error');
  assert.equal(rec.route, '/api/votes');
  assert.equal(rec.status, 503);
  assert.ok(!lines[0].includes('secret') && !lines[0].includes('postgres://') && !lines[0].includes('00000000-0000-4000'));
});

test('a store failure on GET tallies logs api_error with the tallies route', async () => {
  const store = { tallies: async () => { throw new Error('db down'); } };
  const { out, lines } = await captureStderr(() => readTallies({ store, ids: ['hl-1'] }));
  assert.equal(out.status, 503);
  assert.deepEqual(JSON.parse(lines[0]), { event: 'api_error', route: '/api/tallies', status: 503, reason: 'db down' });
});

test('with no database configured both endpoints answer 503 and say why in the logs (the silent outage of 2026-11-18)', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.WYR_VOTE_STORE;
  const a = await captureStderr(() => votes(new Request('https://x.test/api/votes', { method: 'POST', body: JSON.stringify({ questionId: 'hl-1', choice: 'A', visitorId: '00000000-0000-4000-8000-000000000001' }) })));
  const b = await captureStderr(() => tallies(new Request('https://x.test/api/tallies?ids=hl-1')));
  assert.equal(a.out.status, 503);
  assert.equal(b.out.status, 503);
  assert.match(a.lines.join(''), /DATABASE_URL missing/);
  assert.match(b.lines.join(''), /DATABASE_URL missing/);
});

test('logApiError redacts URLs from the reason', async () => {
  const { lines } = await captureStderr(async () => logApiError('/api/votes', new Error('bad https://u:p@h/x?y=1 happened')));
  assert.ok(!lines[0].includes('u:p@h'));
});
