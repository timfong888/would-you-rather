/**
 * Tranche model for the paid questions of a category (docs/specs/kids-family-categories.md §3.4, Tim 2026-11-24:
 * "a tranch of 20 new questions opened every $1.99", then "accept all five tranche defaults").
 *
 * Pure: no React Native, no storage, no payments SDK. It decides which questions a given `Access` opens; where
 * the Access comes from (store entitlements) is lib/catalog.ts.
 *
 * - The free count F is always `getFreeQuestionCount(category)` (8 for kids and teen, 3 or 20 for adult). Never hardcode 8.
 * - Kids and teen categories: the paid questions after F are cut into tranches of 20, in the order the data lists them
 *   (id order). A remainder under 10 joins the previous tranche, otherwise it is its own tranche.
 * - Adult categories are not split: all their paid questions are one tranche (tranche 1).
 * - Access is the SET of owned tranche numbers, never a count or a prefix: a refund of tranche 1 while tranche 2 is
 *   still owned closes exactly tranche 1.
 */
import { getCategoryQuestions, getFreeQuestionCount } from '../constants/questions';
import type { CategoryDef } from '../constants/questions';

export const TRANCHE_SIZE = 20;
/** A trailing remainder shorter than this joins the tranche before it. */
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
  /** First question index in the category list (inclusive). */
  start: number;
  /** One past the last question index. */
  end: number;
  size: number;
}

/** Sizes of the tranches for a paid count, by the remainder rule. An empty list when nothing is paid. */
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

/** The tranches of a category, in order. Adult categories have exactly one (or none when nothing is paid). */
export function trancheRanges(category: CategoryDef): TrancheRange[] {
  const total = getCategoryQuestions(category.id).length;
  const free = getFreeQuestionCount(category);
  const paid = total - free;
  if (paid <= 0) return [];
  const sizes = category.audience === 'adult' ? [paid] : trancheSizes(paid);
  const ranges: TrancheRange[] = [];
  let start = free;
  sizes.forEach((size, i) => {
    ranges.push({ k: i + 1, start, end: start + size, size });
    start += size;
  });
  return ranges;
}

/** 0 for a free question, else the tranche number the question belongs to. */
export function trancheOf(category: CategoryDef, questionIndex: number): number {
  if (questionIndex < getFreeQuestionCount(category)) return 0;
  const hit = trancheRanges(category).find((r) => questionIndex >= r.start && questionIndex < r.end);
  return hit ? hit.k : 0;
}

/** Whether the question at `questionIndex` can be played with this access. */
export function isQuestionOpen(category: CategoryDef, questionIndex: number, access: Access): boolean {
  if (access.all) return true;
  const k = trancheOf(category, questionIndex);
  if (k === 0) return true;
  return access.ownedTranches.has(k);
}

/** True when every paid tranche is open (nothing left to sell in this category). */
export function isCategoryFullyOpen(category: CategoryDef, access: Access): boolean {
  if (access.all) return true;
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
