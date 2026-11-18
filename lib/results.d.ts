export const VOTE_THRESHOLD: number;
export type Tally = { a: number; b: number };
export type ResultDisplay =
  | { kind: 'invite' }
  | { kind: 'percent'; a: number; b: number; total: number };
export function formatResult(tally: Tally | null | undefined, threshold?: number): ResultDisplay;
export const INVITE_TITLE: string;
export const INVITE_TEXT: string;
