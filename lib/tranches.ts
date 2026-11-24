/**
 * Question access model: the free questions, the paid steps, and the all-categories pack
 * (docs/specs/kids-family-categories.md §3.4; Tim 2026-11-24: "each category has N number of free questions, call it 5.
 * Then the next is to open 20 more for $1.99. $4.99 opens across all categories.").
 *
 * Pure: no React Native, no storage, no payments SDK. It decides which questions a given `Access` opens; where the
 * Access comes from (store entitlements) is lib/catalog.ts.
 *
 * ONE rule for every category (adult, kids, teen), by position in its list:
 *   - free: the first FREE_QUESTIONS_PER_CATEGORY (constants/questions.ts, 5), via `targetFreeQuestionCount`. The live screens
 *       keep today's counts until UNIFORM_FREE_COUNT_LIVE (4c).
 *   - step k (k = 1, 2, ...): the next batch, 20 questions (a remainder under 10 joins the step before it). Each costs $1.99
 *       and opens that batch in ONE category.
 *       Kids and teen: membership is FROZEN as explicit question ids in constants/trancheAssignments.ts, so a purchased
 *       `cat_<category>_<k>` opens the same questions forever. `trancheSizes` only generated that table and sizes a NEW step;
 *       it is never re-applied to the live question count (it would shrink an owned step). A kids or teen category has ONE step
 *       for now (Tim: "max it 20 per kid"); the written questions after it are `withheld` (kept, closed, not sold). A paid
 *       question in neither list is CLOSED until it is assigned.
 *       Adult: one step on the existing `cat_<id>`: everything paid in the category (at most 35), as that product sells today.
 *   - the all-categories pack ($4.99) opens STEP 1 of every category (Tim's open question: only step 1, or everything written?
 *     This code does the first; see the PR). Later steps are bought per category.
 * Access is the SET of owned step numbers, never a count or prefix: a refund of step 1 while step 2 is still owned closes
 * exactly step 1.
 *
 * STAGING: the pack is not yet limited (PACK_LIMITED_TO_FIRST_STEP = false). The live paywall still sells "Or unlock every
 * category" as everything, so until 4c changes that paywall the pack keeps opening everything it opens today. 4c flips the
 * flag. The tests exercise both settings, so the target behavior is pinned now.
 */
import { getCategoryQuestions, targetFreeQuestionCount } from '../constants/questions';
import type { CategoryDef } from '../constants/questions';
import { TRANCHE_ASSIGNMENTS } from '../constants/trancheAssignments';

export const TRANCHE_SIZE = 20;
/** A trailing remainder shorter than this joins the tranche before it (when sizing a NEW set of tranches). */
export const MIN_LAST_TRANCHE = 10;
/** Whether the pack is limited to step 1 of every category. false in 4a (staging); 4c turns it on. */
export const PACK_LIMITED_TO_FIRST_STEP = false;

/**
 * What a player has, for one category.
 *  - all: opens every question (owner access, or a legacy full-category entitlement during staging).
 *  - pack: holds the all-categories pack.
 *  - ownedTranches: the tranche numbers bought.
 */
export interface Access {
  all: boolean;
  pack: boolean;
  ownedTranches: ReadonlySet<number>;
}

/** Nothing bought: only the free questions. The access the SEO guards and signed-out paths use. */
export function noAccess(): Access {
  return { all: false, pack: false, ownedTranches: new Set<number>() };
}

export interface TrancheRange {
  /** 1-based tranche number. */
  k: number;
  /** The question ids this tranche opens (frozen for kids and teen). */
  ids: readonly string[];
  size: number;
}

/** Sizes for a count by the remainder rule. Used to define new tranches, never to re-cut owned ones. */
export function trancheSizes(count: number): number[] {
  if (count <= 0) return [];
  const full = Math.floor(count / TRANCHE_SIZE);
  const remainder = count % TRANCHE_SIZE;
  const sizes = new Array<number>(full).fill(TRANCHE_SIZE);
  if (remainder === 0) return sizes;
  if (remainder < MIN_LAST_TRANCHE && sizes.length > 0) {
    sizes[sizes.length - 1] += remainder;
  } else {
    sizes.push(remainder);
  }
  return sizes;
}

function ids(category: CategoryDef): string[] {
  return getCategoryQuestions(category.id).map((q) => q.id);
}

/** The tranches of a category, in order. Adult: one tranche of every paid question (none when nothing is paid). */
export function trancheRanges(category: CategoryDef): TrancheRange[] {
  if (category.audience === 'adult') {
    const paid = ids(category).slice(targetFreeQuestionCount(category));
    return paid.length ? [{ k: 1, ids: paid, size: paid.length }] : [];
  }
  const assigned = TRANCHE_ASSIGNMENTS[category.id]?.tranches ?? [];
  return assigned.map((list, i) => ({ k: i + 1, ids: list, size: list.length }));
}

const trancheMembership = new Map<string, Map<string, number>>();
function idToTranche(category: CategoryDef): Map<string, number> {
  let m = trancheMembership.get(category.id);
  if (!m) {
    m = new Map();
    for (const r of trancheRanges(category)) for (const id of r.ids) m.set(id, r.k);
    trancheMembership.set(category.id, m);
  }
  return m;
}

export interface Zone {
  /** A free question. */
  free: boolean;
  /** In step 1: the all-categories pack opens it once the pack is limited. */
  pack: boolean;
  /** The tranche that opens it, 0 when none. */
  tranche: number;
}

/** Where the question at `questionIndex` sits. A kids or teen paid question in no list has no zone and is closed. */
export function questionZone(category: CategoryDef, questionIndex: number): Zone {
  const free = questionIndex < targetFreeQuestionCount(category);
  const q = getCategoryQuestions(category.id)[questionIndex];
  if (!q) return { free: false, pack: false, tranche: 0 };
  if (category.audience === 'adult') {
    // One step (everything paid); the pack opens the first TRANCHE_SIZE of it.
    const pos = questionIndex - targetFreeQuestionCount(category);
    return { free, pack: !free && pos < TRANCHE_SIZE, tranche: free ? 0 : 1 };
  }
  const tranche = idToTranche(category).get(q.id) ?? 0;
  return { free, pack: tranche === 1, tranche };
}

/** Paid questions of a kids or teen category that neither a step nor `withheld` contains (closed until assigned). Always [] for adult. */
export function unassignedPaidQuestions(category: CategoryDef): string[] {
  if (category.audience === 'adult') return [];
  const m = idToTranche(category);
  const withheld = new Set(TRANCHE_ASSIGNMENTS[category.id]?.withheld ?? []);
  return ids(category)
    .slice(targetFreeQuestionCount(category))
    .filter((id) => !m.has(id) && !withheld.has(id));
}

/** Whether the question at `questionIndex` can be played with this access. */
export function isQuestionOpen(
  category: CategoryDef,
  questionIndex: number,
  access: Access,
  packLimited: boolean = PACK_LIMITED_TO_FIRST_STEP,
): boolean {
  if (access.all) return true;
  const z = questionZone(category, questionIndex);
  if (z.free) return true;
  if (access.pack && (!packLimited || z.pack)) return true;
  return z.tranche > 0 && access.ownedTranches.has(z.tranche);
}

/** How many questions the player can open right now in this category. */
export function openQuestionCount(category: CategoryDef, access: Access, packLimited: boolean = PACK_LIMITED_TO_FIRST_STEP): number {
  const n = getCategoryQuestions(category.id).length;
  let open = 0;
  for (let i = 0; i < n; i++) if (isQuestionOpen(category, i, access, packLimited)) open++;
  return open;
}

/**
 * True when every written question is open. Strict on purpose: withheld kids and teen questions are NOT open, so a boolean
 * caller (`isCategoryEntitled`) never opens them. Use `nextTrancheToSell(...) === null` for "nothing left to buy".
 */
export function isCategoryFullyOpen(category: CategoryDef, access: Access, packLimited: boolean = PACK_LIMITED_TO_FIRST_STEP): boolean {
  return openQuestionCount(category, access, packLimited) === getCategoryQuestions(category.id).length;
}

/**
 * The tranche the paywall offers: the lowest one not owned that still has a closed question. null when there is nothing
 * left to sell (a tranche the pack already opens is not offered).
 */
export function nextTrancheToSell(
  category: CategoryDef,
  access: Access,
  packLimited: boolean = PACK_LIMITED_TO_FIRST_STEP,
): TrancheRange | null {
  if (access.all) return null;
  const list = ids(category);
  return (
    trancheRanges(category).find(
      (r) => !access.ownedTranches.has(r.k) && r.ids.some((id) => !isQuestionOpen(category, list.indexOf(id), access, packLimited)),
    ) ?? null
  );
}
