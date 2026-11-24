# SEO question pages: every question indexed, read-only, feeding the web app (#206)

Status: design proposal, 2026-11-24. Nothing is built. Issue: #206. Related: `docs/seo.md`, `docs/seo/keyword-research-2026-11.md`, `docs/specs/plan.md` row 4s.

## 0. What Tim said (2026-11-24, via the orchestrator)

First message: "We should still have SEO pages display for all of the questions for SEO with a link to the web app. There should not be a way to \"play the app\" from the questions. each question should stand alone as part of a \"woudl you rather\" landing page and there should be cross-linked to improve SEO capability. These should also be linked from the article pillars about questions that are valuable in different situations. Let's no compromise SEO."

Second message (answers to the audit): "here's no read-only page per question. The indexed page is the playable one. (we should always be driving people into the paying version (IOS or Web). We should imagine each question as a stand alone question that we can build on, for example, adding data from what people select, links to other SEO pages about personalities or situations. We need more research on this. 1. One URL per question plus category pages listing them. Yes, it should show related questions, category, and a short intro, and then some language about the benefits for peresonas of using these questions and links to the central hub which is the web app (the web app should display a way to click to download IOS apps on every page of the web app -- and obviously not have that in the IOS version) Yes, all withheld paid questions are public. Pillar articles shoudl live on the same would you rather.fyi site. 4. Search traffic should lange on the page with the web app link. 5. Yes, reuse the share pages, although these are also playable (the share pages should be taking people to the web-app so the user now is able to get value immediately. Someone who is shared a page is in the middle of the funnel. The SEO pages are top of the funnel we need to drive traffic into the web pages which drive them to the pay wall."

Reading: the two messages agree once "play" is pinned down. A search visitor lands on an indexed question page that has no vote or answer control of its own, only a clear link into the playable web app (the hub). A shared link goes straight into the playable web app. All of it drives toward the paywall.

## 1. Funnel and URLs (decision for point (a))

| Funnel stage | Who arrives | Page | What it does |
|---|---|---|---|
| Top | Search, AI answers, pillar articles | `/p/<id>` (indexed, read-only) | Shows the question and its two options, category, short intro, related questions, persona benefit copy, links to the hub, the category page and situation pages. One primary button: "Play this question" to `/game/<id>`. No vote control. |
| Middle | Someone who was sent a link | `/p/<id>?s=1` | Same HTML (so link previews work), but a script sends the visitor straight to `/game/<id>`, the playable web app, so they get value at once. |
| Bottom | Anyone in the web app | `/game/<id>` and the rest of the app | Plays, then hits the paywall. |

Rules:
1. **One page per question, reused from the share pages.** `/p/<id>` already exists for all 586 questions (static HTML with Open Graph tags, `scripts/generate-sharing-pages.mjs`). It becomes the indexed, read-only page, so no new URL scheme is needed.
2. **Canonicals.** `/p/<id>` is canonical to itself. `/p/<id>?s=1` canonicalizes to `/p/<id>` (the same page with a parameter). `/game/<id>` carries `rel=canonical` to `/p/<id>` and leaves the sitemap, so one question has one indexed URL. Category pages and SEO list pages link to `/p/<id>`, not to `/game/<id>`.
3. **Why a parameter, not a redirect for everyone.** One URL cannot be both an indexed page and an instant redirect. The redirect runs only when `?s=1` is present, and the share links the app and the share cards create get that parameter (`lib/shareQuestion.ts`). Search engines and social crawlers fetch the parameter-free canonical, or read the same HTML without running scripts. The parameter is not an identifier and is the same for everyone.
4. **Old shared links** (no `?s=1`) will land on the read-only page with the "Play this question" button: one extra tap, no instant redirect. Accepted unless Tim wants a referrer-based redirect (risk: a crawler that renders scripts and sends no referrer could be redirected).
5. **Sitemap.** Lists `/p/<id>` for every question (free, paid and kids-withheld: 586 today), the 18 category pages, the 14 landing pages, `/`, `/categories`, `/kids`: about 621 URLs, up from 202. `/game/<id>` leaves it. The floor test `tests/unit/seo-counts.test.ts` (never fewer URLs, never fewer listed questions) still holds.
6. **Category pages and SEO list pages list every question** (free and paid), each linking to its `/p/<id>`, and the free count only governs in-app access. The per-question "Play this one" buttons on the list pages (`components/SeoLandingPage.tsx`) become links to the question page plus one hub button, so no list page has a vote control either.
7. **Kids pages follow the kids rule**: no analytics, no storage writes, no third-party requests, no ads, links only to kids destinations, nothing identifying a visitor. Same template, kids copy, kids campaign link.

Paid and withheld questions are public (Tim: "all withheld paid questions are public"), kids included. The product value is playing in the app.

## 2. Every question page (point (c))

Static HTML, built at deploy time, one `<h1>` and one JSON-LD block:
- The question as a heading, the two options as plain text.
- Category and age label, linking to the category page.
- A short intro (two sentences, from the category) so pages are not thin.
- 5 related questions: same category first, then the same persona or situation tag.
- Persona benefit copy: one short paragraph per persona (couples, family dinner, road trips, classrooms, icebreakers), reused across pages, with an extra sentence that names the question's category.
- Links: the hub (`/`), the category page, and 2 to 3 situation pages (`/questions-for-couples`, `/road-trip-would-you-rather-questions`, ...).
- A "Play this question" button to the web app.
- Duplicate risk: 586 near-identical templates can look thin. Mitigation: unique question text, unique related set, a category-specific sentence; do not ship pages whose only unique content is the question until Tim has seen the first batch.

## 3. iOS download link on every web page (point (b))

- Already there: the Apple Smart App Banner meta is in every exported page (`scripts/inject-smart-banner.mjs`); Safari shows nothing until the app is on the store.
- New: an in-page "Get the iOS app" badge in the web app layout, rendered only on web, never in the native app, with the existing campaign link (`lib/appStore.js`: `appStoreUrl`, kids pages use the kids campaign name, which gives Apple-side install counts only).
- Gate: hidden until `APP_STORE_LIVE` (`EXPO_PUBLIC_APP_STORE_LIVE=true`). The app is TestFlight only today, so shipping it behind the flag changes nothing until Tim turns the flag on.

## 4. Data from what people select (point (d))

Already exists: `POST /api/votes` and `GET /api/tallies` keep aggregate counts per question (kids votes carry no visitor id), and `lib/results.js` `formatResult()` applies a display threshold.
Proposal: adult question pages fetch `/api/tallies?ids=<id>` client-side and show "N% chose A" once the threshold is met; no identifier is sent or stored. A build-time snapshot into the static HTML (so crawlers see the numbers) is a second step. Kids pages show no results until Tim and legal (#114) say so. Needs research: whether showing results on a read-only page changes conversion into the app, and whether a snapshot is worth a rebuild.

## 5. Pillar articles (point (e))

Live on the same site: `wouldyourather.fyi/guides/<slug>`, static pages built like the landing pages. Each guide is an article about one situation, with 15 to 20 linked question pages and links to the matching landing page and the hub. First five topics, chosen from the existing landing pages and the 2026-11-17 keyword work, to be re-ranked by the research step:
1. Date night and couples (`questions-for-couples`).
2. Road trips (`road-trip-would-you-rather-questions`).
3. Icebreakers for groups, work and parties (`deep-would-you-rather-questions` is the nearest page today).
4. Family dinner table (`dinner-table-conversation-starters`, `would-you-rather-questions-for-family`).
5. Classroom and teachers (`would-you-rather-questions-for-kindergarten`, `-elementary-students`).
Kids guides follow the kids rule.

## 6. Research step (point (f))

Existing: `docs/seo/keyword-research-2026-11.md` (2026-11-17, OpenSEO, about 320 credits): batch 1 for parents of young kids is done; personas 2 and 3 are not. Kids queries return no volume in the data providers, so demand for kids pages is inferred from who ranks.
Plan, no credits spent until the orchestrator says go:
1. Extend the keyword work to the situations above (couples, road trips, icebreakers, family dinner, classrooms) for volume, difficulty and intent: OpenSEO or Semrush keyword research, one call per situation.
2. Competitor question pages: who ranks for "would you rather" plus a topic, whether they have one URL per question, what a page of theirs contains (Semrush organic research and competitor reports; Exa or TinyFish to read two or three pages).
3. Rank personas and situations by demand versus difficulty; that order sets the pillar sequence.
Tools in this account: Semrush MCP, OpenSEO MCP (asks for confirmation above 2,000 credits per batch), Exa and TinyFish for reading pages. Needed from the orchestrator: a go and a credit budget, and which personas to research first.

## 7. PR plan (separate PRs, none touch payments)

| PR | Change | Notes |
|---|---|---|
| S1 | This design (docs, plan row 4s, #206) | Docs only |
| S2 | `/p/<id>` rebuilt as the read-only indexed page for all questions; `/game/<id>` canonical to it; sitemap lists `/p/<id>`; tests: counts floor, no vote control, canonical rules | Unblocks decoupling SEO from the free count |
| S3 | Category pages and SEO list pages list every question and link to `/p/<id>`; list-page "Play this one" removed; `verify-seo` updated (no longer rejects a listed paid question, still rejects it anywhere a locked question must stay hidden in-app) | Required before 4c flips the free count |
| S4 | Share links carry `?s=1`; `/p/<id>?s=1` goes straight to `/game/<id>` | `lib/shareQuestion.ts`, share-page script |
| S5 | Web-only iOS badge, behind `APP_STORE_LIVE` | Flag stays off until the app is public |
| S6 | Related questions, persona copy, cross-links; link-check test (no orphan pages) | |
| S7 | Adult question pages show aggregate results | After research; adult only |
| S8 | First pillar guides under `/guides/` | After the research step ranks the topics |

4c of the payments plan (#124) waits for S2 and S3, so the free-count flip can never shrink SEO.
