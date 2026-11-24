export interface Guide {
  slug: string;
  kids: boolean;
  updated: string;
  keyword: string;
  title: string;
  h1: string;
  description: string;
  intro: string[];
  sections: { heading: string; text: string; ids: string[] }[];
  tips: string[];
  landing: string[];
}
export const GUIDES: readonly Guide[];
export function guideBySlug(slug: string): Guide | undefined;
export function guideQuestionIds(guide: Guide): string[];
