/**
 * App-facing wrappers for the real vote API (issue #65). The pure logic and its
 * tests are in lib/votes-core.ts.
 */
import { Platform } from 'react-native';
import { SITE_URL } from '@/constants/config';
import { getOrCreateVisitorId, track } from '@/lib/analytics';
import type { Tally } from '@/lib/results';
import { postVote, getTally, getTallies, flushPending, lockedChoice, parsePending, type AckMap, type Choice, type PendingVote } from '@/lib/votes-core';

export type { Choice };

const PENDING_KEY = 'wyr_pending_votes';
const ACK_KEY = 'wyr_voted_v1';

function apiBase(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? '' : SITE_URL;
}

function readPending(): PendingVote[] {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return [];
  try {
    return parsePending(localStorage.getItem(PENDING_KEY));
  } catch {
    return [];
  }
}

function writePending(list: PendingVote[]): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable: the vote is simply not retried
  }
}

function readAcknowledged(): AckMap {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ACK_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAcknowledged(questionId: string, choice: Choice): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify({ ...readAcknowledged(), [questionId]: choice }));
  } catch {
    // storage unavailable: the answer just won't be locked on a revisit
  }
}

/** The answer to restore and lock for a question the player has already voted on, or null. */
export function getLockedChoice(questionId: string): Choice | null {
  return lockedChoice(questionId, readAcknowledged(), readPending());
}

/**
 * Record the player's vote. Resolves to the real tally and the choice the server
 * actually holds for this player (the first vote wins), or nulls (show the invite).
 */
export async function castVote(
  questionId: string,
  choice: Choice,
): Promise<{ tally: Tally | null; choice: Choice | null }> {
  const { id: visitorId } = getOrCreateVisitorId();
  const { tally, choice: stored, retry } = await postVote(fetch, apiBase(), { questionId, choice, visitorId });
  // The vote API failed (down, rate limited or timed out): count it so the daily report shows it.
  if (retry) track('api_error', { route: '/api/votes', kind: 'vote_failed' });
  if (retry) writePending([...readPending().filter((p) => p.questionId !== questionId), { questionId, choice }]);
  // The server answered: remember the choice it holds, so a revisit locks it.
  else if (stored || tally) writeAcknowledged(questionId, stored ?? choice);
  return { tally, choice: stored };
}

/** Real counts for a question the player is looking at again, or null. */
export function fetchTally(questionId: string): Promise<Tally | null> {
  return getTally(fetch, apiBase(), questionId);
}

/** Real counts for several questions (e.g. the feed), or null. */
export function fetchTallies(questionIds: string[]): Promise<Record<string, Tally> | null> {
  return getTallies(fetch, apiBase(), questionIds);
}

/** Retry votes that could not be sent earlier. Call once on app load. */
export async function flushPendingVotes(): Promise<void> {
  const { id: visitorId } = getOrCreateVisitorId();
  await flushPending({
    read: readPending,
    write: writePending,
    acknowledge: writeAcknowledged,
    send: (p) => postVote(fetch, apiBase(), { ...p, visitorId }),
  });
}
