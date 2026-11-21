// GET /api/tallies?ids=hl-1,hl-2  ->  { "hl-1": { a, b }, ... }
// Real counts only; the display threshold is applied by the caller with
// formatResult() from lib/results.js. Spec: FR-2.
import { logApiError, getStore, readTallies, parseTallyIds } from './_lib/votes.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const ids = parseTallyIds(new URL(req.url).searchParams.get('ids'));
  const store = await getStore(process.env);
  const result = store
    ? await readTallies({ store, ids })
    : (logApiError('/api/tallies', new Error('vote store not configured (DATABASE_URL missing)')),
       { status: 503, body: { error: 'unavailable', retryable: true } });
  const cacheable = result.status === 200;
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': cacheable ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store',
    },
  });
}
