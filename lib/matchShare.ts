/**
 * "Share a question and see if your friend matched" (#92). Pure helpers.
 *
 * The sharer's pick travels inside the share link (`?f=<code>`) and the receiver's
 * browser compares it after they vote. Nothing is stored or sent anywhere: no server
 * share record, no persisted ID, no analytics on Kids & Family routes. All wording is
 * in constants/matchLines.json.
 */
import copy from '../constants/matchLines.json';

export type Pick = 'A' | 'B';
/** What a share link says about the sharer: their pick, or 'ask' = "you go first", no pick yet. */
export type Friend = Pick | 'ask';
export type MatchOutcome = 'matched' | 'different';
export type LineSet = 'adult' | 'kids';

// The code is 3 characters: filler, a pick character, filler. It keeps the pick from
// being readable at a glance in a link preview. It is obfuscation, not secrecy: anyone
// can decode it, and the card image and preview text never use it.
const A_SET = 'ahkpvz';
const B_SET = 'bgmtwx';
const ASK_SET = 'ejuy4';
const FILL = '23456789cdfjnqrsy';

const pickFrom = (set: string, rnd: number) => set[Math.floor(rnd * set.length) % set.length];

export function encodePick(pick: Friend, rnd: () => number = Math.random): string {
  const set = pick === 'A' ? A_SET : pick === 'B' ? B_SET : ASK_SET;
  return pickFrom(FILL, rnd()) + pickFrom(set, rnd()) + pickFrom(FILL, rnd());
}

/** What a link code says: a pick, 'ask' (a share with no pick yet), or null if missing or malformed. */
export function decodeFriend(code: unknown): Friend | null {
  if (typeof code !== 'string' || code.length !== 3) return null;
  if (!FILL.includes(code[0]) || !FILL.includes(code[2])) return null;
  if (A_SET.includes(code[1])) return 'A';
  if (B_SET.includes(code[1])) return 'B';
  if (ASK_SET.includes(code[1])) return 'ask';
  return null;
}

/** The pick a link code stands for; null for 'ask', missing or malformed codes. */
export function decodePick(code: unknown): Pick | null {
  const f = decodeFriend(code);
  return f === 'A' || f === 'B' ? f : null;
}

export function matchOutcome(mine: Pick, theirs: Pick): MatchOutcome {
  return mine === theirs ? 'matched' : 'different';
}

export function lineSetFor(kids: boolean): LineSet {
  return kids ? 'kids' : 'adult';
}

export function headingFor(kids: boolean, outcome: MatchOutcome | 'asked'): string {
  return copy[lineSetFor(kids)].heading[outcome];
}

let lastIndex: Record<string, number> = {};

/** A random line from the pool, never the same one twice in a row (kept in memory only). */
export function pickLine(
  kids: boolean,
  outcome: MatchOutcome,
  rnd: () => number = Math.random,
  pool: readonly string[] = copy[lineSetFor(kids)][outcome],
): string {
  if (pool.length === 0) return '';
  const key = `${lineSetFor(kids)}:${outcome}`;
  let i = Math.floor(rnd() * pool.length) % pool.length;
  if (pool.length > 1 && i === lastIndex[key]) i = (i + 1) % pool.length;
  lastIndex[key] = i;
  return pool[i];
}

export function __resetLineMemory(): void {
  lastIndex = {};
}

type ShareKey = 'tell_matched' | 'tell_different' | 'tell_asked' | 'ask_another';

/** Share message text. `{line}` is replaced by the line the player just saw. */
export function shareText(kids: boolean, key: ShareKey, line = ''): string {
  return copy[lineSetFor(kids)].share[key].replace('{line}', line).trim();
}

type UiKey = keyof typeof copy.adult.ui;

/** Button labels and icons of the share/match screens (constants/matchLines.json, "ui"). */
export function uiText(kids: boolean, key: UiKey): string {
  return copy[lineSetFor(kids)].ui[key];
}

export interface MatchEvent {
  name: 'share_opened' | 'share_answered' | 'share_reply_sent';
  props: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Analytics for the match flow. Kids routes send nothing. No pick value is ever sent,
 * only whether the two matched.
 */
export function matchEvent(
  kind: 'opened' | 'answered' | 'reply_sent',
  o: { kids: boolean; questionId: string; visitorId?: string | null; outcome?: MatchOutcome },
): MatchEvent[] {
  if (o.kids) return [];
  const base = { question_id: o.questionId, visitor_id: o.visitorId };
  if (kind === 'opened') return [{ name: 'share_opened', props: base }];
  const matched = o.outcome === undefined ? undefined : o.outcome === 'matched';
  return [{ name: kind === 'answered' ? 'share_answered' : 'share_reply_sent', props: { ...base, matched } }];
}

export const MATCH_COPY = copy;
