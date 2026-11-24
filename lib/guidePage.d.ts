import type { Guide } from './guides';
export function guidePageHtml(args: {
  guide: Guide;
  questionsById: Map<string, { id: string; category: string; optionA: string; optionB: string }>;
  categoriesById: Map<string, { id: string; label: string }>;
  landingTitles: Map<string, string>;
  origin: string;
}): string;
