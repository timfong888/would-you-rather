/**
 * schema.org JSON-LD builders.
 *
 * Pure functions (no React, no react-native) so the build-time checks in
 * scripts/verify-seo.ts can compare what they produce with the exported HTML.
 *
 * Rules these follow:
 *  - Markup must describe content that is on the page. Lists only ever carry
 *    free, playable questions, never locked expansion or premium text.
 *  - Every page is one @graph with stable @ids, so the pieces reference each
 *    other (page -> website, page -> breadcrumb, page -> list).
 *  - FAQPage only for the visible FAQ section of a landing page (real questions
 *    with one answer). A "would you rather" prompt itself is never marked up as
 *    a Question: it has no single accepted answer.
 */
import { SITE_URL } from '@/constants/config';
import type { CategoryDef, Question } from '@/constants/questions';
import { getSeoPageUpdated, type SeoPageDef } from '@/constants/seoPages';

const CONTEXT = 'https://schema.org';
export const SITE_NAME = 'Would You Rather';

export type JsonLd = Record<string, unknown>;

const abs = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
const websiteId = () => `${SITE_URL}/#website`;
const organizationId = () => `${SITE_URL}/#organization`;

/** One-line description of who publishes the site; shown in the About block too. */
export const ORGANIZATION_DESCRIPTION =
  'Would You Rather is a free web game of curated two-choice questions for families, couples and friends, with a Kids & Family pack written for ages 4 to 11.';

export function organizationNode(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': organizationId(),
    name: SITE_NAME,
    url: abs('/'),
    logo: abs('/apple-touch-icon.png'),
    description: ORGANIZATION_DESCRIPTION,
  };
}

export function questionTitle(q: Pick<Question, 'optionA' | 'optionB'>): string {
  return `Would you rather ${q.optionA} or ${q.optionB}?`;
}

export function websiteNode(description?: string): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': websiteId(),
    url: abs('/'),
    name: SITE_NAME,
    inLanguage: 'en',
    ...(description ? { description } : {}),
  };
}

export function breadcrumbNode(pageUrl: string, trail: { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: abs(step.path),
    })),
  };
}

function itemListNode(pageUrl: string, name: string, questions: Question[]): JsonLd {
  return {
    '@type': 'ItemList',
    '@id': `${pageUrl}#questions`,
    name,
    itemListOrder: 'https://schema.org/ItemListUnordered',
    numberOfItems: questions.length,
    itemListElement: questions.map((q, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: questionTitle(q),
      url: abs(`/game/${q.id}`),
    })),
  };
}

/** Home page: the website entity. */
export function homeJsonLd(description: string): JsonLd {
  return { '@context': CONTEXT, '@graph': [websiteNode(description), organizationNode()] };
}

/** One of the SEO landing pages. `questions` must already be the free list. */
export function landingPageJsonLd(page: SeoPageDef, questions: Question[]): JsonLd {
  const url = abs(`/${page.slug}`);
  const graph: JsonLd[] = [
    {
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      dateModified: getSeoPageUpdated(page),
      keywords: page.keywords.join(', '),
      audience: page.ages
        ? {
            '@type': 'PeopleAudience',
            audienceType: page.audienceType,
            suggestedMinAge: page.ages.min,
            suggestedMaxAge: page.ages.max,
          }
        : { '@type': 'Audience', audienceType: page.audienceType },
      ...(page.answer ? { abstract: page.answer } : {}),
      isPartOf: { '@id': websiteId() },
      publisher: { '@id': organizationId() },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@id': `${url}#questions` },
    },
    itemListNode(url, `${page.headline}: ${questions.length} free questions`, questions),
  ];
  // Q&A that is visible on the page (the FAQ section). Answer engines read it;
  // Google shows FAQ rich results only for some sites, which is fine.
  if (page.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      isPartOf: { '@id': `${url}#webpage` },
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  graph.push(
    breadcrumbNode(url, [
      { name: 'Home', path: '/' },
      { name: page.headline, path: `/${page.slug}` },
    ]),
    websiteNode(),
    organizationNode(),
  );
  return { '@context': CONTEXT, '@graph': graph };
}

/** The /categories index: a collection of the category pages. */
export function categoriesIndexJsonLd(categories: CategoryDef[]): JsonLd {
  const url = abs('/categories');
  return {
    '@context': CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: 'Browse Would You Rather Categories',
        inLanguage: 'en',
        isPartOf: { '@id': websiteId() },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: { '@id': `${url}#categories` },
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#categories`,
        name: 'Would You Rather categories',
        itemListOrder: 'https://schema.org/ItemListUnordered',
        numberOfItems: categories.length,
        itemListElement: categories.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.label,
          url: abs(`/categories/${c.id}`),
        })),
      },
      breadcrumbNode(url, [
        { name: 'Home', path: '/' },
        { name: 'Categories', path: '/categories' },
      ]),
      websiteNode(),
    ],
  };
}

/** A category page. `freeQuestions` must be the free list (never locked text). */
export function categoryJsonLd(category: CategoryDef, freeQuestions: Question[]): JsonLd {
  const url = abs(`/categories/${category.id}`);
  const name = `${category.label} Would You Rather Questions`;
  return {
    '@context': CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name,
        inLanguage: 'en',
        isPartOf: { '@id': websiteId() },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: { '@id': `${url}#questions` },
      },
      itemListNode(url, `${category.label}: free questions`, freeQuestions),
      breadcrumbNode(url, [
        { name: 'Home', path: '/' },
        { name: 'Categories', path: '/categories' },
        { name: category.label, path: `/categories/${category.id}` },
      ]),
      websiteNode(),
    ],
  };
}

/** A single question page (only ever rendered for a playable question). */
export function questionPageJsonLd(q: Question, category: CategoryDef | undefined): JsonLd {
  const url = abs(`/game/${q.id}`);
  const trail = [
    { name: 'Home', path: '/' },
    ...(category
      ? [
          { name: 'Categories', path: '/categories' },
          { name: category.label, path: `/categories/${category.id}` },
        ]
      : []),
    { name: questionTitle(q), path: `/game/${q.id}` },
  ];
  return {
    '@context': CONTEXT,
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: questionTitle(q),
        inLanguage: 'en',
        isPartOf: { '@id': websiteId() },
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      breadcrumbNode(url, trail),
      websiteNode(),
    ],
  };
}

/**
 * Serialise for a <script type="application/ld+json"> body. `<` is escaped so
 * question text can never close the script element.
 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
