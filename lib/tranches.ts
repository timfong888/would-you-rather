/**
 * Tranche model for the paid questions of a category (docs/specs/kids-family-categories.md §3.4, Tim 2026-11-24:
 * "a tranch of 20 new questions opened every $1.99", then "accept all five tranche defaults").
 *
 * Pure: no React Native, no storage, no payments SDK. It decides which questions a given `Access` opens; where
 * the Access comes from (store entitlements) is lib/catalog.ts.
 *
 * - The free count F is always `getFreeQuestionCount(category)` (8 for kids and teen, 3 or 20 for adult). Never hardcode 8.
 * - Kids and teen categories: tranche membership is FROZEN as explicit question ids in
 *   constants/trancheAssignments.ts, so a purchased `cat_<category>_<k>` opens the same questions forever. The sizes
 *   rule (`trancheSizes`: 20 per tranche, a remainder under 10 joins the previous one) is only the tool that
 *   generated that table and sizes a NEW tranche; it is never re-applied to the live question count, which would
 *   shrink a tranche someone already owns when the bank grows.
 * - A paid kids or teen question that is in no tranche is CLOSED (only a pack or owner access opens it) until it is assigned.
 * - Adult categories are not split: all their paid questions are one tranche (tranche 1), granted by `cat_<id>`.
 *   An adult category's pack promise already includes "questions added later".
 * - Access is the SET of owned tranche numbers, never a count or a prefix: a refund of tranche 1 while tranche 2 is
 *   still owned closes exactly tranche 1.
 */
import { getCategoryQuestions, getFreeQuestionCount } from '../constants/questions';
import type { CategoryDef } from '../constants/questions';
import { TRANCHE_ASSIGNMENTS } from '../constants/trancheAssignments';

export const TRANCHE_SIZE = 20;
/** A trailing remainder shorter than this joins the tranche before it (when sizing a NEW set of tranches). */
export const MIN_LAST_TRANCHE = 10;

/** What a player has bought, for one category. `all` opens every question (a pack, or owner access). */
export interface Access {
  all: boolean;
  ownedTranches: ReadonlySet<number>;
}

/** Nothing bought: only the free questions. The access the SEO guards and signed-out paths use. */
export function noAccess(): Access {
  return { all: false, ownedTranches: new Set<number>() };
}

export interface TrancheRange {
  /** 1-based tranche number. */
  k: number;
  /** The question ids this tranche opens (frozen for kids and teen). */
  ids: readonly string[];
  size: number;
}

/** Sizes for a paid count by the remainder rule. Used to define new tranches, never to re-cut owned ones. */
export function trancheSizes(paidCount: number): number[] {
  if (paidCount <= 0) return [];
  const full = Math.floor(paidCount / TRANCHE_SIZE);
  const remainder = paidCount % TRANCHE_SIZE;
  const sizes = new Array<number>(full).fill(TRANCHE_SIZE);
  if (remainder === 0) return sizes;
  if (remainder < MIN_LAST_TRANCHE && sizes.length > 0) {
    sizes[sizes.length - 1] += remainder;
  } else {
    sizes.push(remainder);
  }
  return sizes;
}

function paidIds(category: CategoryDef): string[] {
  return getCategoryQuestions(category.id).slice(getFreeQuestionCount(category)).map((q) => q.id);
}

/** The tranches of a category, in order. Adult: one tranche of every paid question (none when nothing is paid). */
export function trancheRanges(category: CategoryDef): TrancheRange[] {
  if (category.audience === 'adult') {
    const ids = paidIds(category);
    return ids.length ? [{ k: 1, ids, size: ids.length }] : [];
  }
  const assigned = TRANCHE_ASSIGNMENTS[category.id] ?? [];
  return assigned.map((ids, i) => ({ k: i + 1, ids, size: ids.length }));
}

const membership = new Map<string, Map<string, number>>();
function idToTranche(category: CategoryDef): Map<string, number> {
  let m = membership.get(category.id);
  if (!m) {
    m = new Map();
    for (const r of trancheRanges(category)) for (const id of r.ids) m.set(id, r.k);
    membership.set(category.id, m);
  }
  return m;
}

/** Paid questions of a kids or teen category that no tranche contains yet (closed until assigned). Always [] for adult. */
export function unassignedPaidQuestions(category: CategoryDef): string[] {
  if (category.audience === 'adult') return [];
  const m = idToTranche(category);
  return paidIds(category).filter((id) => !m.has(id));
}

/**
 * 0 for a free question, the tranche number for a paid one, -1 for a paid kids or teen question that is in no
 * tranche yet (closed).
 */
export function trancheOf(category: CategoryDef, questionIndex: number): number {
  if (questionIndex < getFreeQuestionCount(category)) return 0;
  const q = getCategoryQuestions(category.id)[questionIndex];
  if (!q) return -1;
  if (category.audience === 'adult') return 1;
  return idToTranche(category).get(q.id) ?? -1;
}

/** Whether the question at `questionIndex` can be played with this access. */
export function isQuestionOpen(category: CategoryDef, questionIndex: number, access: Access): boolean {
  if (access.all) return true;
  const k = trancheOf(category, questionIndex);
  if (k === 0) return true;
  if (k === -1) return false;
  return access.ownedTranches.has(k);
}

/** True when every paid question is open: all tranches owned and none left unassigned. */
export function isCategoryFullyOpen(category: CategoryDef, access: Access): boolean {
  if (access.all) return true;
  if (unassignedPaidQuestions(category).length > 0) return false;
  return trancheRanges(category).every((r) => access.ownedTranches.has(r.k));
}

/** The tranche the paywall offers: the lowest one not owned. null when there is nothing left to sell. */
export function nextTrancheToSell(category: CategoryDef, access: Access): TrancheRange | null {
  if (access.all) return null;
  return trancheRanges(category).find((r) => !access.ownedTranches.has(r.k)) ?? null;
}

/** How many questions the player can open right now in this category (free plus owned tranches). */
export function openQuestionCount(category: CategoryDef, access: Access): number {
  const total = getCategoryQuestions(category.id).length;
  if (access.all) return total;
  let open = Math.min(getFreeQuestionCount(category), total);
  for (const r of trancheRanges(category)) if (access.ownedTranches.has(r.k)) open += r.size;
  return open;
}
