/**
 * Activation (#52): a visitor is "activated" when they cast ACTIVATION_VOTES
 * votes in their first session. Pure state machine; the caller persists the
 * state and fires the event.
 */
export const ACTIVATION_VOTES = 3;
export const ACTIVATION_KEY = 'wyr_activation';

export interface ActivationState {
  votes: number;
  activated: boolean;
}

export const INITIAL_ACTIVATION: ActivationState = { votes: 0, activated: false };

/**
 * Records one vote. `fire` is true exactly once: on the vote that reaches the
 * threshold, and only inside the visitor's first session. Votes in later
 * sessions never activate (they are retention, not activation).
 */
export function recordActivationVote(
  state: ActivationState,
  isFirstSession: boolean,
): { state: ActivationState; fire: boolean } {
  if (state.activated || !isFirstSession) return { state, fire: false };
  const votes = state.votes + 1;
  const activated = votes >= ACTIVATION_VOTES;
  return { state: { votes, activated }, fire: activated };
}

export function parseActivationState(raw: string | null | undefined): ActivationState {
  try {
    const p = raw ? JSON.parse(raw) : null;
    if (p && Number.isFinite(p.votes) && typeof p.activated === 'boolean') {
      return { votes: Math.max(0, Math.floor(p.votes)), activated: p.activated };
    }
  } catch {
    /* fall through */
  }
  return INITIAL_ACTIVATION;
}
