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
 *  - No FAQPage / Question markup: Google restricts FAQ rich results, and a
 *    "would you rather" prompt is not a question with a single accepted answer.
 */
import { SITE_URL } from '@/constants/config';
import type { CategoryDef, Question } from '@/constants/questions';
import type { SeoPageDef } from '@/constants/seoPages';

const CONTEXT = 'https://schema.org';
export const SITE_NAME = 'Would You Rather';

export type JsonLd = Record<string, unknown>;

const abs = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;
const websiteId = () => `${SITE_URL}/#website`;

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
  return { '@context': CONTEXT, '@graph': [websiteNode(description)] };
}

/** One of the SEO landing pages. `questions` must already be the free list. */
export function landingPageJsonLd(page: SeoPageDef, questions: Question[]): JsonLd {
  const url = abs(`/${page.slug}`);
  return {
    '@context': CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: page.title,
        description: page.description,
        inLanguage: 'en',
        keywords: page.keywords.join(', '),
        audience: { '@type': 'Audience', audienceType: page.audienceType },
        isPartOf: { '@id': websiteId() },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: { '@id': `${url}#questions` },
      },
      itemListNode(url, `${page.headline}: ${questions.length} free questions`, questions),
      breadcrumbNode(url, [
        { name: 'Home', path: '/' },
        { name: page.headline, path: `/${page.slug}` },
      ]),
      websiteNode(),
    ],
  };
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
