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

test('scrub drops query strings from any scheme, blob/data payloads and scheme-less hosts', () => {
  assert.equal(scrub('socket wss://rt.example.com/live?token=abc123&x=1 closed'), 'socket wss://rt.example.com/live closed');
  assert.equal(scrub('fetch ftp://user:pw@files.example.com/a/b?k=v failed'), 'fetch ftp://files.example.com/a/b failed');
  assert.equal(scrub('bad src blob:https://www.wouldyourather.fyi/3f2a-uuid here'), 'bad src <blob-uri> here');
  assert.equal(scrub('img data:image/png;base64,AAAA1234 broke'), 'img <data-uri> broke');
  assert.equal(scrub('went to www.example.com/p?link_id=abc&gen=2 and failed'), 'went to www.example.com/p and failed');
  assert.equal(scrub('why did this fail? and what?'), 'why did this fail? and what?'); // plain question marks stay
  assert.ok(!scrub('x https://a.test/p?link_id=secret#frag y').includes('secret'));
});

test('scrub: the input cap never leaves half an email, and URLs after "_" or digits are still scrubbed', () => {
  const pre = 'https://h.example.com/p?q=';
  const out = scrub(pre + 'a'.repeat(2000 - pre.length - 14) + ' john.doe@gmail.com tail');
  assert.ok(!/john|doe@|gmai/.test(out), out); // base returned "<email>"; the pre-cap must not leak a fragment
  assert.equal(scrub('Load_https://host.example.com/reset#token=SECRET'), 'Load_https://host.example.com/reset');
  assert.equal(scrub('code 404https://host.example.com/x?k=v'), 'code <url>'); // not a valid scheme: dropped whole, nothing leaks
  assert.equal(scrub('see _data:text/plain;base64,QUJD end'), 'see _<data>-uri end'.replace('<data>-uri', '<data-uri>'));
  assert.equal(scrub('metadata:foo stays'), 'metadata:foo stays'); // not a data: URI
});

test('scrub stays fast on large whitespace-free input (no quadratic backtracking)', () => {
  const big = JSON.stringify({ rows: Array.from({ length: 4000 }, (_, i) => ({ id: i, v: 'abc' + i })) }); // ~100 KB, no spaces
  assert.ok(big.length > 50000 && !/\s/.test(big));
  const alnum = 'a'.repeat(100000);
  for (const input of [big, alnum, 'a'.repeat(50000) + '?', 'x:' + 'a'.repeat(50000)]) {
    const t0 = Date.now();
    scrub(input);
    assert.ok(Date.now() - t0 < 100, `scrub took ${Date.now() - t0} ms on ${input.length} chars`);
  }
});

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
