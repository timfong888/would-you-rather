import { SEO_PAGES } from '../constants/seoPages';
import { RETIRED_KIDS_CATEGORY_IDS, isKidsCategoryId } from '../constants/questions';

// Landing pages written to the kids question bank (they set `questionTag`).
const KIDS_PATHS = new Set(SEO_PAGES.filter((p) => p.questionTag).map((p) => `/${p.slug}`));

const CATEGORY_ROUTE = /^\/(categories|complete|unlock)\/([^/]+)$/;

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * True for kids-bank landing pages, kids questions (`kf-*`) and the category routes of every category whose
 * `audience` is `kids` (youngest age under 13): analytics stays off there (COPPA). The category part reads
 * `audience`, not a list of ids, so a new kids category is covered the moment it is defined (spec §2.3).
 */
export function isKidsPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (KIDS_PATHS.has(path) || /^\/(game|p|results)\/kf-/.test(path)) return true;
  const route = path.match(CATEGORY_ROUTE);
  if (route === null) return false;
  const id = decode(route[2]);
  // A retired kids category (`kids-family`) stays a kids route so a stale link never fires analytics before it redirects.
  return isKidsCategoryId(id) || RETIRED_KIDS_CATEGORY_IDS.includes(id);
}

/**
 * True for an under-13 question id (`kf-*`, including `kf-ai-*` later). Votes on these persist nothing and send
 * no visitor ID. Contract: every question in an `audience: 'kids'` category has a `kf-` id and no other question
 * does (teen questions use `tn-`); tests/unit/audience.test.ts checks it against the data.
 */
export function isKidsQuestion(questionId: string): boolean {
  return /^kf-/.test(questionId);
}
