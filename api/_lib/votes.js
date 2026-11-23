// Vote storage and rules (issue #65). Plain JS so it bundles into the Vercel
// Edge runtime with no TS or path aliases; see docs/specs/would-you-rather-mvp-spec.md §3-4.
//
// The handlers in api/votes.js and api/tallies.js are thin wrappers over the
// functions here. Everything takes its store, question list and secrets as
// arguments, so tests run against a real Postgres (pglite) with no network.

import { MIGRATION_STATEMENTS } from './schema.js';
import { CATEGORIES } from './data.js';

// Categories written for under-13s (audience 'kids'). Read from the data, never a literal id, so a new kids
// category is covered the moment it is defined (docs/specs/kids-family-categories.md §2.3).
export const KIDS_CATEGORIES = new Set(CATEGORIES.filter((c) => c.audience === 'kids').map((c) => c.id));

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUESTION_ID = /^[a-z]{2,4}-\d{1,5}$/;
export const MAX_TALLY_IDS = 50;
export const DB_TIMEOUT_MS = 2000;

export class UnavailableError extends Error {}

/** @param {{ id: string, category: string }[]} questions */
export function indexQuestions(questions) {
  return new Map(questions.map((q) => [q.id, q]));
}

/**
 * Validate a POST /api/votes body.
 * Kids questions need no visitor ID, and one that is sent is dropped here, so it never reaches storage.
 * @returns {{ ok: true, value: { questionId: string, choice: 'A'|'B', visitorId: string | null } } | { ok: false, field: string }}
 */
export function validateVoteBody(body, questionsById) {
  if (!body || typeof body !== 'object') return { ok: false, field: 'body' };
  const { questionId, choice, visitorId } = body;
  if (typeof questionId !== 'string' || !QUESTION_ID.test(questionId) || !questionsById.has(questionId)) {
    return { ok: false, field: 'questionId' };
  }
  if (choice !== 'A' && choice !== 'B') return { ok: false, field: 'choice' };
  if (KIDS_CATEGORIES.has(questionsById.get(questionId).category)) return { ok: true, value: { questionId, choice, visitorId: null } };
  if (typeof visitorId !== 'string' || !UUID_V4.test(visitorId)) return { ok: false, field: 'visitorId' };
  return { ok: true, value: { questionId, choice, visitorId: visitorId.toLowerCase() } };
}

/** Parse GET /api/tallies?ids=a,b. Returns null when invalid. */
export function parseTallyIds(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_TALLY_IDS) return null;
  if (!ids.every((id) => QUESTION_ID.test(id))) return null;
  return ids;
}

/** Coarse region from Vercel's geo headers. The IP address is never read. */
export function geoFromHeaders(headers) {
  const country = (headers.get('x-vercel-ip-country') || '').toUpperCase();
  const region = (headers.get('x-vercel-ip-country-region') || '').toUpperCase();
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    region: /^[A-Z0-9]{1,3}$/.test(region) ? region : null,
  };
}

/**
 * The key that makes a vote unique per voter per question (spec 3.4).
 * Not kids: the visitor UUID, also stored as player_id.
 * Kids (COPPA): the client sends no visitor ID, so every kids vote gets a one-off random
 * key and player_id null. No kids vote can be joined to a device or to another vote.
 */
export async function buildVoterKey({ kids, visitorId }) {
  if (!kids) return { voterKey: visitorId, playerId: visitorId };
  return { voterKey: `kids:${crypto.randomUUID()}`, playerId: null };
}

/**
 * One structured line on stderr for a failed API call, so Vercel runtime errors and logs
 * show it (and the daily report can count it). Route and reason only: no ids, no
 * question text, no connection strings (anything that looks like a URL is dropped).
 */
export function logApiError(route, err, status = 503) {
  const raw = String((err && err.message) || err || 'unknown');
  const reason = raw.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>').slice(0, 160);
  console.error(JSON.stringify({ event: 'api_error', route, status, reason }));
}

function withTimeout(promise, ms = DB_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new UnavailableError('database timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * POST /api/votes core. 201 counted, 200 already voted (not counted again),
 * 400 invalid, 503 storage unavailable. The tally in the response already
 * includes this vote (or the earlier one from the same voter).
 */
export async function recordVote({ store, questionsById, body, geo }) {
  const parsed = validateVoteBody(body, questionsById);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid', field: parsed.field } };
  const { questionId, choice, visitorId } = parsed.value;
  const kids = KIDS_CATEGORIES.has(questionsById.get(questionId).category);
  try {
    const { voterKey, playerId } = await buildVoterKey({ kids, visitorId });
    const result = await withTimeout(
      store.insertVote({
        questionId,
        choice,
        voterKey,
        playerId,
        kids,
        country: kids ? null : geo.country,
        region: kids ? null : geo.region,
      }),
    );
    return {
      status: result.inserted ? 201 : 200,
      // `choice` is the STORED choice: on a repeat vote it is the first one, not the one just sent.
      body: { counted: result.inserted, choice: result.choice, tally: { a: result.a, b: result.b } },
    };
  } catch (err) {
    logApiError('/api/votes', err);
    return { status: 503, body: { error: 'unavailable', retryable: true } };
  }
}

/** GET /api/tallies core. Unknown ids come back as {a:0,b:0}. */
export async function readTallies({ store, ids }) {
  if (!ids) return { status: 400, body: { error: 'invalid', field: 'ids' } };
  try {
    const found = await withTimeout(store.tallies(ids));
    const out = {};
    for (const id of ids) out[id] = found[id] ?? { a: 0, b: 0 };
    return { status: 200, body: out };
  } catch (err) {
    logApiError('/api/tallies', err);
    return { status: 503, body: { error: 'unavailable', retryable: true } };
  }
}

// ── Postgres store ───────────────────────────────────────────────────────────

// Two statements on purpose. If another request for the same voter and question is still
// committing, ON CONFLICT waits for it, but the REST of the same statement keeps its older
// snapshot and cannot see that row. So the insert and the read-back are separate statements:
// the second one gets a fresh snapshot and sees everything committed, including that row.
const INSERT_SQL = `
insert into votes (question_id, choice, voter_key, player_id, kids, country, region)
values ($1::text, $2::char(1), $3::text, $4::uuid, $5::boolean, $6::char(2), $7::text)
on conflict on constraint votes_one_per_voter do nothing
returning choice
`;

const STATE_SQL = `
select
  (select choice from votes where question_id = $1::text and voter_key = $2::text) as mine,
  (select count(*) from votes where question_id = $1::text and choice = 'A')::int as a,
  (select count(*) from votes where question_id = $1::text and choice = 'B')::int as b
`;

const TALLY_SQL = `
select question_id, choice, count(*)::int as n
from votes
where question_id = any($1::text[])
group by question_id, choice
`;

const MISSING_TABLE = '42P01'; // Postgres: undefined_table

/**
 * @param {(text: string, params: unknown[]) => Promise<any[]>} query returns rows
 *   (Neon: sql.query; tests: pglite db.query(...).rows)
 *
 * The votes table is created on first use: if a write finds it missing, the
 * idempotent migration runs once and the write is retried once. A read of a
 * missing table just means "no votes yet" and creates nothing.
 */
export function createSqlStore(query) {
  let ensured = false;
  async function ensureSchema() {
    if (ensured) return;
    for (const stmt of MIGRATION_STATEMENTS) {
      try {
        await query(stmt, []);
      } catch {
        // Two cold starts can race to create the table; the retry below decides.
      }
    }
    ensured = true;
  }
  return {
    async insertVote(v) {
      const params = [v.questionId, v.choice, v.voterKey, v.playerId, v.kids, v.country, v.region];
      let written;
      try {
        written = await query(INSERT_SQL, params);
      } catch (err) {
        if (err?.code !== MISSING_TABLE) throw err;
        await ensureSchema();
        written = await query(INSERT_SQL, params);
      }
      // Keep these two as SEPARATE autocommit calls. Do not wrap them in one transaction or
      // merge them into one statement: under READ COMMITTED a later statement gets a fresh
      // snapshot (it sees a vote another tab has just committed), and a single transaction or
      // statement would not. See the note above INSERT_SQL.
      const [state] = await query(STATE_SQL, [v.questionId, v.voterKey]);
      // The voter's row must exist by now. If it does not, say so rather than guess a choice.
      if (!state || state.mine == null) throw new UnavailableError('stored vote not found');
      return {
        inserted: written.length === 1,
        choice: String(state.mine).trim(),
        a: Number(state.a),
        b: Number(state.b),
      };
    },
    async tallies(ids) {
      let rows;
      try {
        rows = await query(TALLY_SQL, [ids]);
      } catch (err) {
        if (err?.code !== MISSING_TABLE) throw err;
        rows = [];
      }
      const out = {};
      for (const r of rows) {
        out[r.question_id] ??= { a: 0, b: 0 };
        out[r.question_id][String(r.choice).trim() === 'A' ? 'a' : 'b'] = Number(r.n);
      }
      return out;
    },
  };
}

/**
 * Store for a request, or null when storage is not configured (the handlers
 * then answer 503 and the app falls back to the invite screen).
 * `WYR_VOTE_STORE=memory` is for local development only.
 */
export async function getStore(env) {
  if (env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);
    return createSqlStore((text, params) => sql.query(text, params));
  }
  if (env.WYR_VOTE_STORE === 'memory') return (devStore ??= memoryStore());
  return null;
}

let devStore = null;

/** In-memory store with the same contract, for local development. */
export function memoryStore() {
  const rows = new Map(); // `${questionId}|${voterKey}` -> choice
  const tally = (id) => {
    let a = 0;
    let b = 0;
    for (const [k, c] of rows) if (k.startsWith(`${id}|`)) (c === 'A' ? a++ : b++);
    return { a, b };
  };
  return {
    async insertVote(v) {
      const key = `${v.questionId}|${v.voterKey}`;
      const inserted = !rows.has(key);
      if (inserted) rows.set(key, v.choice);
      return { inserted, choice: rows.get(key), ...tally(v.questionId) };
    },
    async tallies(ids) {
      return Object.fromEntries(ids.map((id) => [id, tally(id)]));
    },
  };
}
