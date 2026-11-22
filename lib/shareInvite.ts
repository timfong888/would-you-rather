/**
 * The text that goes with a shared question (#186). The shared link unfurls into a card that
 * already shows the question, so this is only a short invitation to respond: it never repeats
 * the question and never says what the sharer picked. Wording is in constants/shareInvites.json.
 * Pure and dependency-free so it is unit-tested against every real question.
 */
import copy from '../constants/shareInvites.json';

const POOLS = copy as unknown as Record<string, string[]>;

let lastIndex: Record<string, number> = {};

/** A random invitation line for the category, never the same one twice in a row (memory only). */
export function shareInvite(
  categoryId?: string | null,
  rnd: () => number = Math.random,
  pools: Record<string, readonly string[]> = POOLS,
): string {
  const key = categoryId && Array.isArray(pools[categoryId]) ? categoryId : 'default';
  const pool = pools[key];
  if (!pool || pool.length === 0) return '';
  let i = Math.floor(rnd() * pool.length) % pool.length;
  if (pool.length > 1 && i === lastIndex[key]) i = (i + 1) % pool.length;
  lastIndex[key] = i;
  return pool[i];
}

export const SHARE_INVITES = POOLS;

export function __resetInviteMemory(): void {
  lastIndex = {};
}
