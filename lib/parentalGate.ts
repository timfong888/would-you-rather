/**
 * Parental gate for purchases reachable from kids/family content.
 *
 * Tim, 2026-11-18: "no tracking on kids but parents should be using it", so the
 * purchase flow is a parent surface. Apple expects a gate that a young child
 * cannot pass by tapping: here, a three-number sum that is not a times-table
 * fact. A wrong answer issues a fresh challenge.
 */
import { PARENTAL_GATE_CATEGORIES } from '@/constants/questions';

export interface GateChallenge {
  prompt: string;
  answer: number;
}

/** `rand` returns [0, 1); injectable so tests are deterministic. */
export function makeChallenge(rand: () => number = Math.random): GateChallenge {
  const pick = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const a = pick(13, 39);
  const b = pick(13, 39);
  const c = pick(3, 9);
  return { prompt: `${a} + ${b} + ${c}`, answer: a + b + c };
}

export function checkAnswer(challenge: GateChallenge, input: string): boolean {
  const trimmed = input.trim();
  return /^\d{1,3}$/.test(trimmed) && Number(trimmed) === challenge.answer;
}

/**
 * True when a purchase screen opened for this category must show the gate first: every kids and teen
 * category (`audience` is not `adult`; spec §2.3). The gate is a purchase rule; whether analytics is off is
 * a separate one (`isKidsPath`), so the teen paywall keeps the gate and keeps analytics.
 */
export function requiresParentalGate(categoryId: string): boolean {
  return PARENTAL_GATE_CATEGORIES.includes(categoryId as (typeof PARENTAL_GATE_CATEGORIES)[number]);
}
