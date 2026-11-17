---
name: seo-content
description: Plan, write, ship and measure SEO landing pages for a persona, from keyword research through Search Console. Use when asked for "SEO pages", "content for <persona>", "more landing pages", or to review how existing SEO pages perform. Draft; lives in this repo until it moves to global-config.
---

# seo-content (draft)

Turn a persona from the PRD into a small set of landing pages that each answer one search
intent better than what ranks now, and send searchers into the product in one tap.

Worked example: Would You Rather, batch 1 for parents (#63). Research:
`docs/seo/keyword-research-2026-11.md`. Pages: `constants/seoPages.ts`. Mechanics: `docs/seo.md`.

## Rules that do not bend

1. **One page per search intent.** If two keywords would be answered by the same page, they share a page. Never two pages for "X for kids" and "kids X".
2. **Every page earns its place.** Original copy (intro, tips), its own content items, and a reason to land on it rather than the current #1. If you can't say what the page does better than the current #1, don't ship it. Google demotes scaled, low-value content; ten good pages beat a hundred thin ones.
3. **No content reuse across pages.** Each item (here, each question) belongs to exactly one page. The build enforces this (`verify-seo`).
4. **Only publish what's free.** Never put paid or locked content in pages, schema or the sitemap.
5. **No invented numbers.** No made-up counts, ratings or "X% of people…". New content starts at zero and the UI says so.
6. **Kids content is held to a stricter bar.** No romance, violence, brands, scary themes, or anything about bodies, money or family situations that could sting. Have a human read every kids item before merge.
7. **Spend is capped.** Ask before any research batch over 2,000 OpenSEO credits. A full persona batch should cost about 300–600 credits.

## 1. Research (OpenSEO)

Project: `list_projects` → the product's project (US, en).

1. **Seed per funnel stage** for the persona (5 seeds max per call, `research_keywords`, ~54 credits each):
   - TOFU: "<content> for <persona>" lists ("would you rather questions for kids")
   - MOFU: the job the content does ("family dinner questions", "road trip games")
   - BOFU: the product category ("would you rather app / game")
2. **Filter** the output to rows whose keyword actually matches the topic (seed outputs are noisy).
3. **Score a curated list** of 50–150 keywords with `get_keyword_metrics` (`includeMonthlyTrends: false`). This is cheap.
4. **Hidden volume.** Queries aimed at children (anything with "kids") come back with no volume, because Google Ads restricts that data. Don't treat that as zero. Infer demand from grade/age variants, the parent head term, and whether page 1 is full of dedicated pages. Then measure it in Search Console after launch (step 6).
5. **SERP check** the top ~10 candidates with `get_serp_results` (mobile, depth 10, ~5 credits each). For each, note: who ranks (domain type and size), the format (list, PDF, video, app store), and **the gap**: what none of them do.
6. Write it up in `docs/seo/keyword-research-<yyyy-mm>.md`: tables per persona × funnel (keyword, volume, KD, intent, notes), the SERP table, the gaps, the cluster → page map.

## 2. Clusters → page plan

- Group keywords by **intent**, not by spelling. Test: would the same page fully satisfy both searches?
- One row per page: slug (= primary keyword, hyphenated), primary keyword, secondary keywords, funnel stage, persona, age band if any.
- Start with 10–15 pages per persona. Priority order: low KD × clear gap × fits the product. Put seasonal pages first if the season is within ~8 weeks (they need time to index).
- Include at least one **BOFU** page (product-intent query). In batch 1, "would you rather app" was 6,600/mo, KD 1, $2.80 CPC, and held by app stores and download mirrors.

## 3. Generation

For each page, add an entry to `SEO_PAGES` (`constants/seoPages.ts`):

| Field | Rule |
|---|---|
| `title` | Primary keyword first, ≤ 60 chars, unique |
| `description` | ≤ 155 chars, says what's on the page and the hook (free, no sign-up) |
| `headline` / `subheadline` | h1 = primary keyword in natural form; sub = the promise |
| `bestFor` | Age band + occasions ("Ages 4–6 · bedtime") |
| `intro` | 2 short paragraphs: why this list, who it's for. No filler, no "In today's busy world" |
| `tips` | 2–3 concrete how-to-use tips specific to the page's occasion |
| `answerQuestion` / `answer` | The search query as a question, plus a direct 40–60-word answer (see section 7) |
| `faq` | 2 real questions parents ask, with short answers. Visible on the page and in FAQPage |
| `questionTag` + content | The page's own items, written fresh. 10–25 per page |
| `persona`, `funnel`, `ages`, `keywords` | From the page plan |

Then: route file `app/<slug>.tsx` (one line), and a `vercel.json` rewrite before the catch-all.

**Writing the content.** Write each set against the page's intent and age band (4–6: two concrete
things they can picture; 6–10: bigger ideas with a reason; family: about the family). Mix it up
across a set. Read every item aloud: if a parent would hesitate to say it to their kid, cut it.

**Template** (`components/SeoLandingPage.tsx`), already built:
hero with one-tap play (no sign-in) → intro → items (each with "Play this one" link + Share) →
How to play → explore CTA → links to the persona's other pages, then other lists. JSON-LD:
`CollectionPage` + `ItemList` + `BreadcrumbList` + `WebSite`, with `PeopleAudience` ages when set.

## 4. QA (before the PR)

- `npm run build:web` passes: verify-data, sitemap/robots/llms.txt, export, verify-seo (titles, canonicals, one h1, JSON-LD equals the builder, no locked text, no question on two pages, intro + tips present, answer text in the static HTML, AI crawlers not blocked, llms.txt lists every page).
- Look at 2–3 pages at phone width (Playwright, iPhone 13). Tap through: landing → play → result → next.
- Read every new content item once, as a parent.
- Copy check: no claims you can't back up ("works offline", "loved by 10,000 families").
- Rich Results Test on the preview URL for one page.

## 5. Ship

PR with the Vercel preview link and the page table. Merge on green CI plus a review PASS.
Production deploy needs the owner's go.

## 6. Measure (Search Console)

- After deploy: submit `sitemap.xml` in Search Console **and Bing Webmaster Tools**, ping IndexNow, and request indexing for the new URLs.
- **Week 2:** impressions per page. This is the first real volume number for queries with hidden volume. Pages with 0 impressions: check they're indexed (URL Inspection) before judging them.
- **Week 4–6:** for each page, look at queries with impressions but position > 10. Add the queries people actually used to `keywords`, and extend the intro or items to answer them.
- **Week 8:** CTR by page. Low CTR at a decent position → rewrite the title and description.
- Product metrics (PostHog): `seo_cta_clicked`, `seo_question_clicked`, `share_clicked` with `surface: seo_landing`, per `slug`. Pages that get traffic but no plays need a better hero or better first items.
- Log each review in `docs/seo/` (date, page, change, why) so the next batch learns from it.

## 7. Answer engines (AEO/GEO)

Goal: ChatGPT search, Perplexity, Google AI Overviews, Claude and Copilot quote the page and cite
it as the source. There is no single standard for this, and no existing skill covered it before
this section. What moves the needle, in order:

1. **Content in the HTML, no JavaScript needed.** Most AI crawlers don't run JS. Pages here are
   pre-rendered (`web.output: static`); `verify-seo --dist` fails if a page's answer text isn't in
   the exported HTML. To check by hand: `curl -s <url> | grep "<a line of the answer>"`.
2. **Crawlers allowed.** `robots.txt` (generated by `scripts/generate-sitemap.ts`) has an explicit
   group for the AI search and citation bots (OAI-SearchBot, ChatGPT-User, PerplexityBot,
   Perplexity-User, ClaudeBot, Claude-SearchBot, Claude-User, Googlebot, Bingbot, Applebot), so a
   later blanket rule can't block them by accident. Training-only crawlers (GPTBot,
   Google-Extended, CCBot, Applebot-Extended) are a separate business decision; the default is allow.
3. **Answer first.** Each page sets `answerQuestion` (an H2 shaped like the search query) and
   `answer`: a 40–60-word direct answer, self-contained enough to be quoted without the rest of
   the page. Then the list. Short, self-contained paragraphs; question-shaped subheadings.
4. **Visible FAQ + schema.** `faq` renders as a visible "Questions Parents Ask" section and as
   `FAQPage` JSON-LD. Never mark up Q&A that isn't on the page. The full graph is: `CollectionPage`
   (with `dateModified`, `publisher`, `abstract` = the answer) + `ItemList` + `FAQPage` +
   `BreadcrumbList` + `WebSite` + `Organization`.
5. **Freshness and source.** A visible "Last updated" date (matching `dateModified`) and an About
   block naming who publishes the page.
6. **Original data.** Answer engines cite original numbers most. Once votes are real (stored, not
   seeded), show "X% of families chose …" with the sample size on each question. **Never show
   seeded or invented counts**: the landing template no longer shows vote percentages at all.
7. **llms.txt / llms-full.txt** (generated, at the site root): a markdown map and the full text of
   every page. Cheap to add, but no major answer engine has confirmed it uses these. Don't treat
   them as the main lever.
8. **Index fast.** `sitemap.xml` with honest `lastmod`. After each production deploy: submit the
   sitemap in Bing Webmaster Tools (ChatGPT search draws on Bing's index) and ping IndexNow
   (OpenSEO `submit_indexnow_urls`) with the new and changed URLs.
9. **Measure.** About two weeks after launch, run OpenSEO AI visibility (`research_ai_visibility_prompts`,
   `run_ai_visibility_check`) on prompts like "would you rather questions for kids" and
   "family dinner conversation starters": are we cited, and who is cited instead? Keep runs under
   2,000 credits. Log the results in `docs/seo/`.

## Next batches (from batch 1 research)

- Parents: winter, animals, bedtime, summer, Easter.
- Couples (persona 2): "questions to ask your partner" 22,200, "would you rather questions for couples" 12,100, "date night questions" 1,300.
- Teens/groups (persona 3): "would you rather questions for teenagers" 5,400, icebreakers, sleepovers, students.
