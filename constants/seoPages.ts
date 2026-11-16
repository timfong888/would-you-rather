/**
 * SEO landing pages: the single source of truth.
 *
 * Everything that has to agree about these pages reads this registry: the route
 * files (app/<slug>.tsx), the page component, the JSON-LD, the sitemap
 * generator, the vercel.json rewrites and scripts/verify-seo.ts. Add a page
 * here, add its thin route file and its vercel.json rewrite, and the build
 * checks tell you if anything is missing.
 *
 * Only questions a first-time visitor can play for free are ever listed
 * (getAccessibleQuestions with categoryUnlocked = false), so the pages never
 * publish locked expansion or premium text.
 */
import {
  CATEGORIES,
  DARING,
  FAMILY_FRIENDLY,
  getAccessibleQuestions,
  type CategoryDef,
  type CategoryId,
  type Question,
} from './questions';

export interface SeoPageDef {
  /** URL path segment; also the route file name (app/<slug>.tsx). */
  slug: string;
  /** <title> and og:title. */
  title: string;
  /** meta description and og:description. */
  description: string;
  /** Visible <h1>. */
  headline: string;
  subheadline: string;
  ctaLabel: string;
  /** schema.org Audience.audienceType. */
  audienceType: string;
  /** Categories to draw from, listed round-robin so the page stays varied. */
  categoryIds: CategoryId[];
  /** Max questions on the page. */
  limit: number;
  keywords: string[];
}

export const SEO_PAGES: SeoPageDef[] = [
  {
    slug: 'would-you-rather-questions-for-kids',
    title: '20 Would You Rather Questions for Kids — Fun Family Dilemmas',
    description:
      "Free Would You Rather questions for kids: fun family dilemmas for dinner tables and road trips that spark real conversations. No download needed.",
    headline: 'Would You Rather Questions for Kids',
    subheadline:
      'Turn car rides and dinner tables into unforgettable family conversations. 20 kid-friendly dilemmas — free to play, no download needed.',
    ctaLabel: 'Play Free Now →',
    audienceType: 'Families with children',
    categoryIds: FAMILY_FRIENDLY,
    limit: 20,
    keywords: ['would you rather questions for kids', 'family conversation starters', 'road trip games'],
  },
  {
    slug: 'dinner-table-conversation-starters',
    title: 'Dinner Table Conversation Starters — Would You Rather Dilemmas',
    description:
      "Dinner table conversation starters: Would You Rather dilemmas that get families and friends talking, no phones needed. Free to play, no account required.",
    headline: 'Dinner Table Conversation Starters',
    subheadline:
      'Put the phones down. These Would You Rather dilemmas spark real debates and bring people together — no awkward silences required.',
    ctaLabel: 'Start the Conversation →',
    audienceType: 'Families and friends',
    categoryIds: ['moral-compass', 'social-blunders', 'career-climber'],
    limit: 20,
    keywords: ['dinner table conversation starters', 'would you rather questions', 'family dinner games'],
  },
  {
    slug: 'deep-would-you-rather-questions',
    title: 'Deep Would You Rather Questions — Thought-Provoking Dilemmas',
    description:
      "Deep Would You Rather questions about values, desires and what people rarely say out loud. Ideal for late nights and real conversations. Free to start.",
    headline: 'Deep Would You Rather Questions',
    subheadline:
      "The questions you don't normally ask. Reveal what people actually value — and what they secretly fear. Best played after midnight.",
    ctaLabel: 'Go Deep →',
    audienceType: 'Adults',
    categoryIds: DARING,
    limit: 20,
    keywords: ['deep would you rather questions', 'thought-provoking questions', 'late night conversation'],
  },
  {
    slug: 'questions-for-couples',
    title: 'Would You Rather Questions for Couples — Deepen Your Connection',
    description:
      "Would You Rather questions for couples that reveal how you really think. Ideal for date nights and long conversations. Free to start, no account needed.",
    headline: 'Would You Rather for Couples',
    subheadline:
      'You think you know each other. These questions will surprise you. Share a question, compare answers, and see where you actually stand.',
    ctaLabel: 'Play Together →',
    audienceType: 'Couples',
    categoryIds: ['moral-compass', 'midnight-secrets', 'deep-desires'],
    limit: 20,
    keywords: ['would you rather questions for couples', 'date night questions', 'couples conversation starters'],
  },
];

export function getSeoPage(slug: string): SeoPageDef | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}

/**
 * The free, playable questions for a page, drawn round-robin across its
 * categories (so a three-category page is not twenty questions from the first).
 */
export function getSeoPageQuestions(page: SeoPageDef): Question[] {
  const pools = page.categoryIds
    .map((id) => CATEGORIES.find((c): c is CategoryDef => c.id === id))
    .filter((c): c is CategoryDef => c !== undefined)
    .map((c) => getAccessibleQuestions(c, false));

  const picked: Question[] = [];
  for (let round = 0; picked.length < page.limit; round++) {
    let tookAny = false;
    for (const pool of pools) {
      if (round < pool.length && picked.length < page.limit) {
        picked.push(pool[round]);
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }
  return picked;
}
