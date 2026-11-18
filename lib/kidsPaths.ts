import { SEO_PAGES } from '../constants/seoPages';

// Landing pages written to the kids question bank (they set `questionTag`).
const KIDS_PATHS = new Set(SEO_PAGES.filter((p) => p.questionTag).map((p) => `/${p.slug}`));

/** True for kids-bank landing pages and kids questions (`kf-*`): analytics stays off there (COPPA). */
export function isKidsPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return KIDS_PATHS.has(path) || /^\/(game|p)\/kf-/.test(path);
}
