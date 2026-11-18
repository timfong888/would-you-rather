/**
 * App-facing wrappers for the real vote API (issue #65). The pure logic and its
 * tests are in lib/votes-core.ts.
 */
import { Platform } from 'react-native';
import { SITE_URL } from '@/constants/config';
import { getOrCreateVisitorId } from '@/lib/analytics';
import type { Tally } from '@/lib/results';
import { postVote, getTally, getTallies, type Choice } from '@/lib/votes-core';

export type { Choice };

const PENDING_KEY = 'wyr_pending_votes';

function apiBase(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? '' : SITE_URL;
}

function readPending(): { questionId: string; choice: Choice }[] {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function writePending(list: { questionId: string; choice: Choice }[]): void {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable: the vote is simply not retried
  }
}

/** Record the player's vote. Resolves to the real tally, or null (show the invite). */
export async function castVote(questionId: string, choice: Choice): Promise<Tally | null> {
  const { id: visitorId } = getOrCreateVisitorId();
  const { tally, retry } = await postVote(fetch, apiBase(), { questionId, choice, visitorId });
  if (retry) writePending([...readPending().filter((p) => p.questionId !== questionId), { questionId, choice }]);
  return tally;
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
  const pending = readPending();
  if (!pending.length) return;
  const { id: visitorId } = getOrCreateVisitorId();
  const stillPending: typeof pending = [];
  for (const p of pending) {
    const { retry } = await postVote(fetch, apiBase(), { ...p, visitorId });
    if (retry) stillPending.push(p);
  }
  writePending(stillPending);
}
