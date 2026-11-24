/**
 * Question access model: the all-categories pack, the free questions, and the paid tranches
 * (docs/specs/kids-family-categories.md §3.4; Tim 2026-11-24: "Only the first 20 per category come with the pack unlock",
 * "1.99 buys the next 20 in a category", repeatable).
 *
 * Pure: no React Native, no storage, no payments SDK. It decides which questions a given `Access` opens; where the
 * Access comes from (store entitlements) is lib/catalog.ts.
 *
 * Per category, by position in its list:
 *   - free: the first `getFreeQuestionCount(category)` (8 for kids and teen, 3 or 20 for adult). Never hardcode 8.
 *   - pack zone: positions up to PACK_QUESTION_LIMIT (20). The all-categories pack opens these (once it is limited).
 *   - tranches: everything beyond. Each $1.99 tranche opens the next batch in ONE category.
 *       Kids and teen: membership is FROZEN as explicit question ids in constants/trancheAssignments.ts, so a purchased
 *       `cat_<category>_<k>` opens the same questions forever. The sizes rule (`trancheSizes`) only generated that table and
 *       sizes a NEW tranche; it is never re-applied to the live question count (it would shrink an owned tranche).
 *       A kids or teen paid question in no list is CLOSED until it is assigned.
 *       Adult: one tranche (all paid questions), granted by the existing `cat_<id>`; not split.
 * Access is the SET of owned tranche numbers, never a count or prefix: a refund of tranche 1 while tranche 2 is still owned
 * closes exactly tranche 1.
 *
 * STAGING: the pack is not yet limited (PACK_LIMITED_TO_FIRST_20 = false). The live paywall still sells "Or unlock every
 * category" as everything, so until 4c changes that paywall the pack keeps opening everything it opens today. 4c flips the
 * flag. The tests exercise both settings, so the target behavior is pinned now.
 */
import { getCategoryQuestions, getFreeQuestionCount } from '../constants/questions';
import type { CategoryDef } from '../constants/questions';
import { TRANCHE_ASSIGNMENTS } from '../constants/trancheAssignments';

export const TRANCHE_SIZE = 20;
/** A trailing remainder shorter than this joins the tranche before it (when sizing a NEW set of tranches). */
export const MIN_LAST_TRANCHE = 10;
/** The all-categories pack opens the first this-many questions of every category (Tim, 2026-11-24). */
export const PACK_QUESTION_LIMIT = 20;
/** Whether the pack is limited to the first PACK_QUESTION_LIMIT questions. false in 4a (staging); 4c turns it on. */
export const PACK_LIMITED_TO_FIRST_20 = false;

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
    const paid = ids(category).slice(getFreeQuestionCount(category));
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

/** Kids and teen: ids the pack opens. Adult: none listed (the pack zone is by position). */
function packIds(category: CategoryDef): ReadonlySet<string> {
  return new Set(TRANCHE_ASSIGNMENTS[category.id]?.pack ?? []);
}

export interface Zone {
  /** A free question. */
  free: boolean;
  /** In the pack zone: the all-categories pack opens it once the pack is limited. */
  pack: boolean;
  /** The tranche that opens it, 0 when none. */
  tranche: number;
}

/** Where the question at `questionIndex` sits. A kids or teen paid question in no list has no zone and is closed. */
export function questionZone(category: CategoryDef, questionIndex: number): Zone {
  const free = questionIndex < getFreeQuestionCount(category);
  const q = getCategoryQuestions(category.id)[questionIndex];
  if (!q) return { free: false, pack: false, tranche: 0 };
  if (category.audience === 'adult') {
    return { free, pack: questionIndex < PACK_QUESTION_LIMIT, tranche: free ? 0 : 1 };
  }
  return { free, pack: packIds(category).has(q.id), tranche: idToTranche(category).get(q.id) ?? 0 };
}

/** Paid questions of a kids or teen category that no list contains yet (closed until assigned). Always [] for adult. */
export function unassignedPaidQuestions(category: CategoryDef): string[] {
  if (category.audience === 'adult') return [];
  const pack = packIds(category);
  const m = idToTranche(category);
  return ids(category)
    .slice(getFreeQuestionCount(category))
    .filter((id) => !pack.has(id) && !m.has(id));
}

/** Whether the question at `questionIndex` can be played with this access. */
export function isQuestionOpen(
  category: CategoryDef,
  questionIndex: number,
  access: Access,
  packLimited: boolean = PACK_LIMITED_TO_FIRST_20,
): boolean {
  if (access.all) return true;
  const z = questionZone(category, questionIndex);
  if (z.free) return true;
  if (access.pack && (!packLimited || z.pack)) return true;
  return z.tranche > 0 && access.ownedTranches.has(z.tranche);
}

/** How many questions the player can open right now in this category. */
export function openQuestionCount(category: CategoryDef, access: Access, packLimited: boolean = PACK_LIMITED_TO_FIRST_20): number {
  const n = getCategoryQuestions(category.id).length;
  let open = 0;
  for (let i = 0; i < n; i++) if (isQuestionOpen(category, i, access, packLimited)) open++;
  return open;
}

/** True when every question is open: nothing left to buy. */
export function isCategoryFullyOpen(category: CategoryDef, access: Access, packLimited: boolean = PACK_LIMITED_TO_FIRST_20): boolean {
  return openQuestionCount(category, access, packLimited) === getCategoryQuestions(category.id).length;
}

/**
 * The tranche the paywall offers: the lowest one not owned that still has a closed question. null when there is nothing
 * left to sell (a tranche the pack already opens is not offered).
 */
export function nextTrancheToSell(
  category: CategoryDef,
  access: Access,
  packLimited: boolean = PACK_LIMITED_TO_FIRST_20,
): TrancheRange | null {
  if (access.all) return null;
  const list = ids(category);
  return (
    trancheRanges(category).find(
      (r) => !access.ownedTranches.has(r.k) && r.ids.some((id) => !isQuestionOpen(category, list.indexOf(id), access, packLimited)),
    ) ?? null
  );
}
