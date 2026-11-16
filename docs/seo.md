# SEO

One source of truth, checked at build time.

## Where things live

| What | File |
|---|---|
| The landing pages (slug, title, description, headline, which categories) | `constants/seoPages.ts` |
| JSON-LD builders (schema.org) | `lib/seo.ts`, emitted by `components/JsonLd.tsx` |
| Page template | `components/SeoLandingPage.tsx` (route files `app/<slug>.tsx` are one-liners) |
| Sitemap + robots.txt | `scripts/generate-sitemap.ts` (writes `public/sitemap.xml`, `public/robots.txt`) |
| Rewrites that serve each page's own HTML | `vercel.json` |
| Build checks | `scripts/verify-seo.ts` |

## Add a landing page

1. Add an entry to `SEO_PAGES` in `constants/seoPages.ts`.
2. Add `app/<slug>.tsx`: `return <SeoLandingPage slug="<slug>" />;`
3. Add `{ "source": "/<slug>", "destination": "/<slug>.html" }` to `vercel.json`, before the catch-all.

`npm run build:web` runs `verify:seo` and fails if any of those is missing, if the sitemap
and the pages disagree, or if a locked question's text appears on a page.

## Rules

- **Free content only.** Pages and schema list only questions a first-time visitor can play
  (`getAccessibleQuestions(category, false)`). Locked expansion/premium text is never published
  on these pages or in the sitemap.
- **One host.** The sitemap, `robots.txt`, canonicals and JSON-LD all use `EXPO_PUBLIC_SITE_URL`
  (`constants/config.ts`). Set it in Vercel for Production to the real domain.
- **Why the rewrites.** Without a rewrite, `/some-page` is not a file on Vercel and falls through
  to the catch-all, which serves the home page's HTML (home title, home canonical) to crawlers.
- **Schema.** Each page is one `@graph`: landing pages are `CollectionPage` + `ItemList` +
  `BreadcrumbList` + `WebSite`; home is `WebSite`; category and question pages get the same
  pieces at runtime. No `FAQPage`: Google limits FAQ rich results, and a "would you rather"
  prompt is not a question with one accepted answer.
- **Known limit.** `/game/:id` and `/categories/:id` are served from one shared HTML template, so
  their `<title>`, canonical and JSON-LD are applied by JavaScript. Google renders JS, but the
  landing pages (real per-page HTML) are the pages to rank. Per-id static HTML would need a
  generation step like `scripts/generate-sharing-pages.mjs`.

## Check it by hand

Google's Rich Results Test and the Schema Markup Validator accept a URL or pasted HTML. Run them
against a deployed landing page; they cannot be run from the build.
