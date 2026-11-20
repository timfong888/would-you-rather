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
import { isKidsQuestion } from './kidsPaths';

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
  vote: { questionId: string; choice: Choice; visitorId?: string },
): Promise<{ tally: Tally | null; choice: Choice | null; retry: boolean }> {
  const res = await request(fetchImpl, `${base}/api/votes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(vote),
  });
  if (!res) return { tally: null, choice: null, retry: true };
  if (res.status === 201 || res.status === 200) {
    try {
      const json = await res.json();
      return {
        tally: isTally(json?.tally) ? json.tally : null,
        // The server's stored choice (the first vote wins), when it sent one.
        choice: json?.choice === 'A' || json?.choice === 'B' ? json.choice : null,
        retry: false,
      };
    } catch {
      return { tally: null, choice: null, retry: false };
    }
  }
  // 503 / 429 are worth retrying later; 400 is not.
  return { tally: null, choice: null, retry: res.status === 503 || res.status === 429 };
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


// ── kids questions (COPPA) ───────────────────────────────────────────────────

/**
 * The POST /api/votes body. Kids questions carry no visitor ID at all: the server
 * gives each kids vote a one-off key, so nothing ties it to a device.
 */
export function voteBody(questionId: string, choice: Choice, visitorId: string): { questionId: string; choice: Choice; visitorId?: string } {
  return isKidsQuestion(questionId) ? { questionId, choice } : { questionId, choice, visitorId };
}

/** A stored answer map without kids questions (kids answers are never kept in storage). */
export function withoutKidsAnswers<T extends Record<string, unknown>>(map: T): T {
  return Object.fromEntries(Object.entries(map).filter(([id]) => !isKidsQuestion(id))) as T;
}

/** The retry queue without kids votes (they are never queued or retried). */
export function withoutKidsPending(list: PendingVote[]): PendingVote[] {
  return list.filter((p) => !isKidsQuestion(p.questionId));
}

// ── retry queue ──────────────────────────────────────────────────────────────

export type PendingVote = { questionId: string; choice: Choice };

const pendingKey = (p: PendingVote) => `${p.questionId}:${p.choice}`;

/**
 * The retry queue from its stored JSON. Keeps EVERY valid entry (one per question,
 * the latest wins): the queue is bounded by the number of questions, so there is no
 * cap, and a cap would silently drop votes.
 */
export function parsePending(raw: string | null): PendingVote[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const byQuestion = new Map<string, PendingVote>();
  for (const e of parsed) {
    if (e && typeof e.questionId === 'string' && e.questionId && (e.choice === 'A' || e.choice === 'B')) {
      byQuestion.set(e.questionId, { questionId: e.questionId, choice: e.choice });
    }
  }
  return [...byQuestion.values()];
}

/**
 * Queue after a flush: the queue as it is NOW, minus only the entries that were
 * sent (or rejected for good). Entries added while the flush was awaiting
 * requests are kept, so a vote cast during the flush is never dropped.
 */
export function queueAfterFlush(current: PendingVote[], done: PendingVote[]): PendingVote[] {
  const finished = new Set(done.map(pendingKey));
  return current.filter((p) => !finished.has(pendingKey(p)));
}

/** The answer to show and keep: the server's stored choice wins over what was just tapped. */
export function reconcileChoice(tapped: Choice, stored: Choice | null): Choice {
  return stored ?? tapped;
}

// ── which answers are locked ─────────────────────────────────────────────────

export type AckMap = Record<string, Choice>;

/**
 * The answer to restore and lock on a revisit, or null to let the player answer.
 * Only a vote the server acknowledged, or one queued for retry, counts. The old
 * "answered questions" list (from before votes were stored) is deliberately not an
 * input: those answers never reached the server, so those players may still vote.
 */
export function lockedChoice(questionId: string, acknowledged: AckMap, pending: PendingVote[]): Choice | null {
  const ack = acknowledged[questionId];
  if (ack === 'A' || ack === 'B') return ack;
  return pending.find((p) => p.questionId === questionId)?.choice ?? null;
}

// ── retry flush ──────────────────────────────────────────────────────────────

export type FlushDeps = {
  read: () => PendingVote[];
  write: (list: PendingVote[]) => void;
  /** Remember the choice the server holds, so the question stays locked once its queue entry is gone. */
  acknowledge: (questionId: string, choice: Choice) => void;
  send: (v: PendingVote) => Promise<{ tally: Tally | null; choice: Choice | null; retry: boolean }>;
};

/**
 * Send every queued vote once. A vote the server answered (accepted or refused for good)
 * leaves the queue and, if accepted, is acknowledged; a retryable failure stays queued.
 * The queue is re-read at the end so votes queued while sending are kept.
 */
export async function flushPending(deps: FlushDeps): Promise<void> {
  const pending = deps.read();
  if (!pending.length) return;
  const done: PendingVote[] = [];
  for (const p of pending) {
    const { tally, choice, retry } = await deps.send(p);
    if (retry) continue;
    done.push(p);
    if (choice || tally) deps.acknowledge(p.questionId, choice ?? p.choice);
  }
  deps.write(queueAfterFlush(deps.read(), done));
}
