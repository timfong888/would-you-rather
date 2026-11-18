// POST /api/votes  { questionId, choice: 'A'|'B', visitorId }
// Stores one real vote (one per voter per question) and returns the tally.
// Spec: docs/specs/would-you-rather-mvp-spec.md FR-1. Rate limiting is a Vercel
// Firewall rule, so no IP reaches this code or the database.
import { QUESTIONS } from './_lib/data.js';
import { logApiError, getStore, recordVote, geoFromHeaders, indexQuestions } from './_lib/votes.js';

export const config = { runtime: 'edge' };

// No store means DATABASE_URL is missing: say so in the logs instead of failing silently.
function unconfigured(route) {
  logApiError(route, new Error('vote store not configured (DATABASE_URL missing)'));
  return { status: 503, body: { error: 'unavailable', retryable: true } };
}

const QUESTIONS_BY_ID = indexQuestions(QUESTIONS);
const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...JSON_HEADERS, allow: 'POST' },
    });
  }
  let body = null;
  try {
    const text = await req.text();
    if (text.length <= 2048) body = JSON.parse(text);
  } catch {
    body = null;
  }
  const store = await getStore(process.env);
  const result = store
    ? await recordVote({
        store,
        questionsById: QUESTIONS_BY_ID,
        body,
        geo: geoFromHeaders(req.headers),
        secret: process.env.VOTER_KEY_SECRET,
      })
    : unconfigured('/api/votes');
  return new Response(JSON.stringify(result.body), { status: result.status, headers: JSON_HEADERS });
}
