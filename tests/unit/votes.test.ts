// Vote storage, API core and display rule (issue #65).
// Runs the real SQL (db/migrations + api/_lib/votes.js) against an in-process
// Postgres (pglite), so the unique constraint and the kids check are exercised
// for real, not mocked. Run: npm test
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore plain JS
import { MIGRATION_STATEMENTS } from '../../api/_lib/schema.js';
import { PGlite } from '@electric-sql/pglite';
// @ts-ignore plain JS
import { createSqlStore, recordVote, readTallies, parseTallyIds, indexQuestions, geoFromHeaders, buildVoterKey, memoryStore } from '../../api/_lib/votes.js';
// @ts-ignore plain JS
import { QUESTIONS } from '../../api/_lib/data.js';
// @ts-ignore plain JS
import { formatResult, VOTE_THRESHOLD } from '../../lib/results.js';

// npm test runs from the repo root.
const migration = readFileSync(join(process.cwd(), 'db', 'migrations', '001_votes.sql'), 'utf8');
const questionsById = indexQuestions(QUESTIONS);
const ADULT_Q = 'hl-1';
const KIDS_Q = 'kf-1';
const SECRET = 'test-secret';
type Geo = { country: string | null; region: string | null };
const NO_GEO: Geo = { country: null, region: null };

let db: PGlite;
let store: ReturnType<typeof createSqlStore>;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const vote = (visitor: number, choice: 'A' | 'B', questionId = ADULT_Q, geo: Geo = NO_GEO) =>
  recordVote({ store, questionsById, body: { questionId, choice, visitorId: uuid(visitor) }, geo, secret: SECRET });

before(async () => {
  db = new PGlite();
  await db.exec(migration);
  await db.exec(migration); // idempotent: running it twice must not fail
  store = createSqlStore(async (text: string, params: unknown[]) => (await db.query(text, params)).rows as any[]);
});

beforeEach(async () => {
  await db.exec('truncate votes restart identity');
});

test('a vote is stored as a raw row with its choice, voter and time', async () => {
  const res = await vote(1, 'A');
  assert.equal(res.status, 201);
  const { rows } = await db.query<any>('select question_id, choice, player_id, kids, created_at from votes');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].question_id, ADULT_Q);
  assert.equal(rows[0].choice.trim(), 'A');
  assert.equal(rows[0].player_id, uuid(1)); // anonymous device id, queryable per player
  assert.equal(rows[0].kids, false);
  assert.ok(rows[0].created_at instanceof Date);
});

test('each new voter increments the count, and the response already includes their vote', async () => {
  assert.deepEqual((await vote(1, 'A')).body.tally, { a: 1, b: 0 });
  assert.deepEqual((await vote(2, 'B')).body.tally, { a: 1, b: 1 });
  assert.deepEqual((await vote(3, 'A')).body.tally, { a: 2, b: 1 });
  const read = await readTallies({ store, ids: [ADULT_Q] });
  assert.deepEqual((read.body as any)[ADULT_Q], { a: 2, b: 1 });
});

test('the same voter cannot vote twice on a question: 200, not counted, first choice kept', async () => {
  await vote(1, 'A');
  const again = await vote(1, 'B');
  assert.equal(again.status, 200);
  assert.equal(again.body.counted, false);
  assert.equal(again.body.choice, 'A', 'the response names the STORED choice, not the one just sent');
  assert.deepEqual(again.body.tally, { a: 1, b: 0 });
  const { rows } = await db.query<any>('select count(*)::int as n from votes');
  assert.equal(rows[0].n, 1);
});

test('the same voter can vote on different questions', async () => {
  await vote(1, 'A', 'hl-1');
  const other = await vote(1, 'B', 'hl-2');
  assert.equal(other.status, 201);
});

test('coarse region is stored from geo headers; the table has no IP column', async () => {
  await vote(1, 'A', ADULT_Q, { country: 'US', region: 'CA' });
  const { rows } = await db.query<any>('select country, region from votes');
  assert.equal(rows[0].country.trim(), 'US');
  assert.equal(rows[0].region, 'CA');
  const cols = await db.query<any>("select column_name from information_schema.columns where table_name = 'votes'");
  assert.ok(!cols.rows.some((c) => /ip|addr/i.test(c.column_name)), 'no IP-like column');
});

test('kids votes carry no player id, no region, and a per-question key', async () => {
  const res = await vote(1, 'A', KIDS_Q, { country: 'US', region: 'CA' });
  assert.equal(res.status, 201);
  const { rows } = await db.query<any>('select player_id, kids, country, region, voter_key from votes');
  assert.equal(rows[0].kids, true);
  assert.equal(rows[0].player_id, null);
  assert.equal(rows[0].country, null);
  assert.equal(rows[0].region, null);
  assert.notEqual(rows[0].voter_key, uuid(1)); // HMAC, not the visitor id
  // still one vote per device per kids' question
  assert.equal((await vote(1, 'B', KIDS_Q)).body.counted, false);
  // two kids' questions from one device do not share a key
  await vote(1, 'A', 'kf-2');
  const keys = await db.query<any>('select distinct voter_key from votes');
  assert.equal(keys.rows.length, 2);
});

test('the database itself refuses a kids vote that carries a player id', async () => {
  await assert.rejects(
    db.query("insert into votes (question_id, choice, voter_key, player_id, kids) values ('kf-1','A','k',$1,true)", [uuid(9)]),
  );
});

test('kids votes fail closed (503) when VOTER_KEY_SECRET is missing', async () => {
  const res = await recordVote({ store, questionsById, body: { questionId: KIDS_Q, choice: 'A', visitorId: uuid(1) }, geo: NO_GEO, secret: undefined });
  assert.equal(res.status, 503);
  const { rows } = await db.query<any>('select count(*)::int as n from votes');
  assert.equal(rows[0].n, 0);
});

test('invalid input is rejected with 400 and stores nothing', async () => {
  const bad = [
    { questionId: 'nope-1', choice: 'A', visitorId: uuid(1) },
    { questionId: ADULT_Q, choice: 'C', visitorId: uuid(1) },
    { questionId: ADULT_Q, choice: 'A', visitorId: 'not-a-uuid' },
    { questionId: ADULT_Q, choice: 'A' },
    null,
  ];
  for (const body of bad) {
    const res = await recordVote({ store, questionsById, body, geo: NO_GEO, secret: SECRET });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const { rows } = await db.query<any>('select count(*)::int as n from votes');
  assert.equal(rows[0].n, 0);
});

test('a storage failure answers 503 retryable, never throws', async () => {
  const broken = { insertVote: async () => { throw new Error('db down'); }, tallies: async () => { throw new Error('db down'); } };
  const res = await recordVote({ store: broken, questionsById, body: { questionId: ADULT_Q, choice: 'A', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET });
  assert.equal(res.status, 503);
  assert.equal(res.body.retryable, true);
  assert.equal((await readTallies({ store: broken, ids: [ADULT_Q] })).status, 503);
});

test('tallies: unknown ids are {a:0,b:0}; bad id lists are rejected', async () => {
  await vote(1, 'A');
  const res = await readTallies({ store, ids: parseTallyIds(`${ADULT_Q},hl-2`) });
  assert.deepEqual(res.body, { [ADULT_Q]: { a: 1, b: 0 }, 'hl-2': { a: 0, b: 0 } });
  assert.equal(parseTallyIds(''), null);
  assert.equal(parseTallyIds('x; drop table votes'), null);
  assert.equal(parseTallyIds(Array.from({ length: 51 }, (_, i) => `hl-${i + 1}`).join(',')), null);
  assert.equal((await readTallies({ store, ids: null })).status, 400);
});

test('geo headers are sanitised; the IP is never read', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.deepEqual(geoFromHeaders(h({ 'x-vercel-ip-country': 'us', 'x-vercel-ip-country-region': 'ca' })), { country: 'US', region: 'CA' });
  assert.deepEqual(geoFromHeaders(h({ 'x-vercel-ip-country': 'USA', 'x-vercel-ip-country-region': "'; drop" })), { country: null, region: null });
  assert.deepEqual(geoFromHeaders(h({ 'x-forwarded-for': '1.2.3.4' })), { country: null, region: null });
});

test('voter key: adult = visitor id; kids = deterministic HMAC with no player id', async () => {
  assert.deepEqual(await buildVoterKey({ kids: false, visitorId: uuid(1), questionId: ADULT_Q, secret: SECRET }), { voterKey: uuid(1), playerId: uuid(1) });
  const a = await buildVoterKey({ kids: true, visitorId: uuid(1), questionId: KIDS_Q, secret: SECRET });
  const b = await buildVoterKey({ kids: true, visitorId: uuid(1), questionId: KIDS_Q, secret: SECRET });
  const c = await buildVoterKey({ kids: true, visitorId: uuid(1), questionId: 'kf-2', secret: SECRET });
  assert.equal(a.playerId, null);
  assert.equal(a.voterKey, b.voterKey);
  assert.notEqual(a.voterKey, c.voterKey);
});

test('the in-memory dev store honours the same contract', async () => {
  const mem = memoryStore();
  const r1 = await recordVote({ store: mem, questionsById, body: { questionId: ADULT_Q, choice: 'A', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET });
  const r2 = await recordVote({ store: mem, questionsById, body: { questionId: ADULT_Q, choice: 'B', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET });
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.choice, 'A');
  assert.deepEqual(r2.body.tally, { a: 1, b: 0 });
});

// ── display rule ─────────────────────────────────────────────────────────────

test('below the threshold: invite, never a percentage, never "0"', () => {
  assert.equal(VOTE_THRESHOLD, 20);
  for (const t of [{ a: 0, b: 0 }, { a: 1, b: 0 }, { a: 10, b: 9 }, null, undefined]) {
    assert.deepEqual(formatResult(t as any), { kind: 'invite' }, JSON.stringify(t));
  }
});

test('at and above the threshold: real percentages with the real total', () => {
  assert.deepEqual(formatResult({ a: 10, b: 10 }), { kind: 'percent', a: 50, b: 50, total: 20 });
  assert.deepEqual(formatResult({ a: 89, b: 54 }), { kind: 'percent', a: 62, b: 38, total: 143 });
  assert.deepEqual(formatResult({ a: 20, b: 0 }), { kind: 'percent', a: 100, b: 0, total: 20 });
});

test('percentages always sum to 100 and garbage input falls back to the invite', () => {
  for (let a = 0; a <= 30; a++) {
    const r = formatResult({ a, b: 30 - a }) as any;
    assert.equal(r.kind, 'percent');
    assert.equal(r.a + r.b, 100);
  }
  assert.deepEqual(formatResult({ a: -1, b: 30 }), { kind: 'invite' });
  assert.deepEqual(formatResult({ a: NaN, b: 30 } as any), { kind: 'invite' });
});

test('the question bank carries no seeded vote counts', () => {
  assert.ok(!QUESTIONS.some((q: any) => 'votesA' in q || 'votesB' in q));
});

// ── table is created on first use ────────────────────────────────────────────

test('the first vote creates the table by itself; a read before that returns no votes', async () => {
  const fresh = new PGlite(); // no migration applied
  const freshStore = createSqlStore(async (text: string, params: unknown[]) => (await fresh.query(text, params)).rows as any[]);
  const empty = await readTallies({ store: freshStore, ids: [ADULT_Q] });
  assert.deepEqual(empty.body, { [ADULT_Q]: { a: 0, b: 0 } });
  const tables = await fresh.query<any>("select count(*)::int as n from information_schema.tables where table_name = 'votes'");
  assert.equal(tables.rows[0].n, 0, 'a read must not create anything');

  const res = await recordVote({ store: freshStore, questionsById, body: { questionId: ADULT_Q, choice: 'A', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.tally, { a: 1, b: 0 });
  assert.equal((await recordVote({ store: freshStore, questionsById, body: { questionId: ADULT_Q, choice: 'B', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET })).status, 200);
  await fresh.close();
});

test('a failure that is not "table missing" is not swallowed by the migration path', async () => {
  const calls: string[] = [];
  const failing = createSqlStore(async (text: string) => { calls.push(text.slice(0, 20)); throw Object.assign(new Error('boom'), { code: '08006' }); });
  const res = await recordVote({ store: failing, questionsById, body: { questionId: ADULT_Q, choice: 'A', visitorId: uuid(1) }, geo: NO_GEO, secret: SECRET });
  assert.equal(res.status, 503);
  assert.equal(calls.length, 1, 'no migration attempt, no retry');
});

test('db/migrations/001_votes.sql and the in-code schema are the same statement', () => {
  const stripped = migration.replace(/--.*$/gm, '').replace(/;\s*$/m, '').replace(/\s+/g, ' ').trim();
  const inCode = MIGRATION_STATEMENTS.join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(stripped.replace(/\s*;\s*$/, ''), inCode);
});
