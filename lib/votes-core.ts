/**
 * Pure client logic for the vote API (issue #65, spec FR-1 / FR-2): no React
 * Native imports, so it runs under plain Node in tests. The app-facing
 * wrappers are in lib/votes.ts.
 *
 * The app never adds its own vote to a count and never shows a number it did
 * not get from the server. Any failure resolves to null, which the screens
 * render as the invite to share (see formatResult in lib/results.js).
 */
import type { Tally } from './results';

export type Choice = 'A' | 'B';
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 2000;

function isTally(x: unknown): x is Tally {
  const t = x as Tally | null;
  return !!t && Number.isFinite(t.a) && Number.isFinite(t.b) && t.a >= 0 && t.b >= 0;
}

async function request(fetchImpl: FetchLike, url: string, init?: RequestInit): Promise<Response | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    return await fetchImpl(url, { ...init, signal: ctrl?.signal });
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** POST one vote. Returns the tally that already includes it, or null on any failure. */
export async function postVote(
  fetchImpl: FetchLike,
  base: string,
  vote: { questionId: string; choice: Choice; visitorId: string },
): Promise<{ tally: Tally | null; retry: boolean }> {
  const res = await request(fetchImpl, `${base}/api/votes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vote),
  });
  if (!res) return { tally: null, retry: true };
  if (res.status === 201 || res.status === 200) {
    try {
      const json = await res.json();
      return { tally: isTally(json?.tally) ? json.tally : null, retry: false };
    } catch {
      return { tally: null, retry: false };
    }
  }
  // 503 / 429 are worth retrying later; 400 is not.
  return { tally: null, retry: res.status === 503 || res.status === 429 };
}

/** GET the stored counts for one question (CDN-cached for up to 60 s), or null. */
export async function getTally(fetchImpl: FetchLike, base: string, questionId: string): Promise<Tally | null> {
  const res = await request(fetchImpl, `${base}/api/tallies?ids=${encodeURIComponent(questionId)}`);
  if (!res || !res.ok) return null;
  try {
    const json = await res.json();
    return isTally(json?.[questionId]) ? json[questionId] : null;
  } catch {
    return null;
  }
}

/** GET stored counts for up to 50 questions. Missing or failed: null. */
export async function getTallies(
  fetchImpl: FetchLike,
  base: string,
  questionIds: string[],
): Promise<Record<string, Tally> | null> {
  if (questionIds.length === 0 || questionIds.length > 50) return null;
  const res = await request(fetchImpl, `${base}/api/tallies?ids=${questionIds.map(encodeURIComponent).join(',')}`);
  if (!res || !res.ok) return null;
  try {
    const json = await res.json();
    const out: Record<string, Tally> = {};
    for (const id of questionIds) if (isTally(json?.[id])) out[id] = json[id];
    return out;
  } catch {
    return null;
  }
}


// ── retry queue ──────────────────────────────────────────────────────────────

export type PendingVote = { questionId: string; choice: Choice };

const pendingKey = (p: PendingVote) => `${p.questionId}:${p.choice}`;

/**
 * Queue after a flush: the queue as it is NOW, minus only the entries that were
 * sent (or rejected for good). Entries added while the flush was awaiting
 * requests are kept, so a vote cast during the flush is never dropped.
 */
export function queueAfterFlush(current: PendingVote[], done: PendingVote[]): PendingVote[] {
  const finished = new Set(done.map(pendingKey));
  return current.filter((p) => !finished.has(pendingKey(p)));
}
