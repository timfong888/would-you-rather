import { SEO_PAGES } from '../constants/seoPages';

// Landing pages written to the kids question bank (they set `questionTag`).
const KIDS_PATHS = new Set(SEO_PAGES.filter((p) => p.questionTag).map((p) => `/${p.slug}`));

/** True for kids-bank landing pages and kids questions (`kf-*`): analytics stays off there (COPPA). */
export function isKidsPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  // Kids & Family flow: its questions (kf-*) and every route that carries the kids category.
  return (
    KIDS_PATHS.has(path) ||
    /^\/(game|p|results)\/kf-/.test(path) ||
    /^\/(categories|complete|unlock)\/kids-family$/.test(path)
  );
}
