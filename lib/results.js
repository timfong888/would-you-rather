// Display rule for "how others answered" (issue #65, spec BR-2).
//
// Plain JS on purpose: the app (TypeScript, Metro) and the Vercel functions in
// api/ (no TS, no path aliases) both import this one file, so the rule cannot
// drift between the game screen, the results screens and the share card.
//
// Below the threshold we never show a percentage and never a "0" or a made-up
// split: the caller shows the share invitation instead.

/** Minimum votes on a question before real percentages are shown. */
export const VOTE_THRESHOLD = 20;

/**
 * @param {{ a: number, b: number } | null | undefined} tally
 * @param {number} [threshold]
 * @returns {{ kind: 'invite' } | { kind: 'percent', a: number, b: number, total: number }}
 */
export function formatResult(tally, threshold = VOTE_THRESHOLD) {
  if (!tally) return { kind: 'invite' };
  const a = Number(tally.a);
  const b = Number(tally.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return { kind: 'invite' };
  const total = a + b;
  if (total < threshold || total === 0) return { kind: 'invite' };
  const pctA = Math.round((100 * a) / total);
  return { kind: 'percent', a: pctA, b: 100 - pctA, total };
}

/** Copy shown instead of numbers while a question is below the threshold. */
export const INVITE_TITLE = 'New question';
export const INVITE_TEXT = 'Send it to someone and see if they pick the same.';
