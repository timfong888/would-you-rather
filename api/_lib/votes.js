// Vote storage and rules (issue #65). Plain JS so it bundles into the Vercel
// Edge runtime with no TS or path aliases; see docs/specs/would-you-rather-mvp-spec.md §3-4.
//
// The handlers in api/votes.js and api/tallies.js are thin wrappers over the
// functions here. Everything takes its store, question list and secrets as
// arguments, so tests run against a real Postgres (pglite) with no network.

export const KIDS_CATEGORY = 'kids-family';

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
 * @returns {{ ok: true, value: { questionId: string, choice: 'A'|'B', visitorId: string } } | { ok: false, field: string }}
 */
export function validateVoteBody(body, questionsById) {
  if (!body || typeof body !== 'object') return { ok: false, field: 'body' };
  const { questionId, choice, visitorId } = body;
  if (typeof questionId !== 'string' || !QUESTION_ID.test(questionId) || !questionsById.has(questionId)) {
    return { ok: false, field: 'questionId' };
  }
  if (choice !== 'A' && choice !== 'B') return { ok: false, field: 'choice' };
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

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The key that makes a vote unique per voter per question (spec 3.4).
 * Not kids: the visitor UUID, also stored as player_id.
 * Kids: HMAC(secret, visitor + ':' + question), player_id null, so two kids'
 * votes cannot be joined to one device.
 */
export async function buildVoterKey({ kids, visitorId, questionId, secret }) {
  if (!kids) return { voterKey: visitorId, playerId: visitorId };
  if (!secret) throw new UnavailableError('VOTER_KEY_SECRET is not set');
  return { voterKey: await hmacHex(secret, `${visitorId}:${questionId}`), playerId: null };
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
export async function recordVote({ store, questionsById, body, geo, secret }) {
  const parsed = validateVoteBody(body, questionsById);
  if (!parsed.ok) return { status: 400, body: { error: 'invalid', field: parsed.field } };
  const { questionId, choice, visitorId } = parsed.value;
  const kids = questionsById.get(questionId).category === KIDS_CATEGORY;
  try {
    const { voterKey, playerId } = await buildVoterKey({ kids, visitorId, questionId, secret });
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
      body: { counted: result.inserted, tally: { a: result.a, b: result.b } },
    };
  } catch {
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
  } catch {
    return { status: 503, body: { error: 'unavailable', retryable: true } };
  }
}

// ── Postgres store ───────────────────────────────────────────────────────────

const INSERT_SQL = `
with ins as (
  insert into votes (question_id, choice, voter_key, player_id, kids, country, region)
  values ($1::text, $2::char(1), $3::text, $4::uuid, $5::boolean, $6::char(2), $7::text)
  on conflict on constraint votes_one_per_voter do nothing
  returning choice
)
select
  (select count(*) from ins)::int as inserted,
  ((select count(*) from votes where question_id = $1::text and choice = 'A')
    + (select count(*) from ins where choice = 'A'))::int as a,
  ((select count(*) from votes where question_id = $1::text and choice = 'B')
    + (select count(*) from ins where choice = 'B'))::int as b
`;

const TALLY_SQL = `
select question_id, choice, count(*)::int as n
from votes
where question_id = any($1::text[])
group by question_id, choice
`;

/**
 * @param {(text: string, params: unknown[]) => Promise<any[]>} query returns rows
 *   (Neon: sql.query; tests: pglite db.query(...).rows)
 */
export function createSqlStore(query) {
  return {
    async insertVote(v) {
      const rows = await query(INSERT_SQL, [v.questionId, v.choice, v.voterKey, v.playerId, v.kids, v.country, v.region]);
      const r = rows[0];
      return { inserted: Number(r.inserted) === 1, a: Number(r.a), b: Number(r.b) };
    },
    async tallies(ids) {
      const rows = await query(TALLY_SQL, [ids]);
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
      return { inserted, ...tally(v.questionId) };
    },
    async tallies(ids) {
      return Object.fromEntries(ids.map((id) => [id, tally(id)]));
    },
  };
}
