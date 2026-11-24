# SEO question pages: every question indexed, read-only, feeding the web app (#206)

Status: design proposal, 2026-11-24. Nothing is built. Issue: #206. Related: `docs/seo.md`, `docs/seo/keyword-research-2026-11.md`, `docs/specs/plan.md` row 4s.

## 0. What Tim said (2026-11-24, via the orchestrator)

First message: "We should still have SEO pages display for all of the questions for SEO with a link to the web app. There should not be a way to \"play the app\" from the questions. each question should stand alone as part of a \"woudl you rather\" landing page and there should be cross-linked to improve SEO capability. These should also be linked from the article pillars about questions that are valuable in different situations. Let's no compromise SEO."

Second message (answers to the audit): "here's no read-only page per question. The indexed page is the playable one. (we should always be driving people into the paying version (IOS or Web). We should imagine each question as a stand alone question that we can build on, for example, adding data from what people select, links to other SEO pages about personalities or situations. We need more research on this. 1. One URL per question plus category pages listing them. Yes, it should show related questions, category, and a short intro, and then some language about the benefits for peresonas of using these questions and links to the central hub which is the web app (the web app should display a way to click to download IOS apps on every page of the web app -- and obviously not have that in the IOS version) Yes, all withheld paid questions are public. Pillar articles shoudl live on the same would you rather.fyi site. 4. Search traffic should lange on the page with the web app link. 5. Yes, reuse the share pages, although these are also playable (the share pages should be taking people to the web-app so the user now is able to get value immediately. Someone who is shared a page is in the middle of the funnel. The SEO pages are top of the funnel we need to drive traffic into the web pages which drive them to the pay wall."

Third message (corrections, 2026-11-24): "1. When I mean reuse the share pages, I mean that sends them to the web app. When someone like an adult shares a specific question from the app into an iMessage or Facebook Group, it is shared to the web app version. The reason: we don't need search traffic to get to the playable one, someone is already doing so. 2. Vote data: this is just an aggregate count that we are keeping in Neon as we get real data (or we can get fake data to bootstrap it and then when we receive meaningful numbers replace it). That is my preference."

Reading: a search visitor lands on an indexed question page that has no vote or answer control of its own, only a clear link into the playable web app (the hub). A shared link goes straight to the playable web app. All of it drives toward the paywall. Search and sharing are different jobs and get different URLs.

## 0.1 Tim's answers to the six questions (2026-11-24)

Tim's exact words: "1. Yes 2. Accept 3. first batch 4. Percentages is fine, make sure it's just aggreagte and no identifying information 5. approve 2000 credits 6. Persona 1 is parents searching on games, entertatining kids, brain develop, conversation skills, importance of building habit of talking early, dads who want to connect with kids"

Decisions:
1. The design below is approved: `/q/<id>` indexed read-only pages, shared links go into the playable web app. The spike (section 1b) found the Share action should stay on `/p/<id>`, which already does that; Tim's answer on 1b is pending.
2. Seed numbers: accepted that seeds stay OFF for now. Percentages appear only after 20 real votes (today's rule); revisit when real votes exist. The labelled blend in section 4 stays documented, not shipped.
3. Launch with a first batch of about 100 question pages, then expand with the research (section 1a).
4. Percentages are approved as **aggregate counts only, with no identifying information anywhere** (no voter ids, no per-user rows exposed by any endpoint or page). Kids pages show none until legal #114 unless Tim says otherwise (asked).
5. Research budget: up to 2,000 credits across OpenSEO and Semrush; stop and ask before going over.
6. Persona 1 is parents searching for games, entertaining kids, brain development, conversation skills, the importance of building the habit of talking early, and dads who want to connect with their kids. This replaces the earlier persona definition.

## 1. Funnel and URLs (revised 2026-11-24 after Tim's correction)

Tim's correction: "When I mean reuse the share pages, I mean that sends them to the web app. When someone like an adult shares a specific question from the app into an iMessage or Facebook Group, it is shared to the web app version. The reason: we don't need search traffic to get to the playable one, someone is already doing so."

Two jobs, two URLs, no redirect trick:

| Funnel stage | Who arrives | URL | What it is |
|---|---|---|---|
| Top | Search, AI answers, pillar articles | `/q/<id>` (new) | Indexed, read-only question page: question and options, category, intro, related questions, persona copy, links to the hub and situation pages, one button "Play this question" to `/game/<id>`. No vote control. Canonical to itself. Sits in the sitemap, all 586 questions. |
| Middle | Someone who got a shared link | `/p/<id>` (the existing share page) | The in-app Share action keeps producing this URL (section 1b). It unfurls in iMessage and Facebook, sends a web visitor straight into the playable web app (`/game/<id>`), and opens the installed iOS app. |
| Bottom | Anyone in the web app | `/game/<id>` and the rest of the app | Plays, then meets the paywall. |

Rules:
1. **The Share action stays on `/p/<id>`** (spike result, section 1b). No `?s=1`, no new redirect, no per-question app shells. If Tim wants `/game/<id>` as the share URL instead, section 1b lists the cost.
2. **Unfurling is unchanged**: `/p/<id>` already carries the per-question Open Graph tags (`lib/sharePage.js`).
3. **The playable page and the share page must not compete in the index.** For a question that has a `/q/<id>` page, `/game/<id>` and `/p/<id>` carry `<link rel=canonical href="/q/<id>">`, are not in the sitemap, and the question JSON-LD moves from `/game/<id>` to `/q/<id>`. (Canonical only, not `noindex`: the two together send search engines conflicting signals.)
4. **Links already shared keep working**: `/p/<id>` behaves exactly as today.
5. **Sitemap**: the first batch (section 1a, about 100 questions) is listed at `/q/<id>` instead of `/game/<id>` one for one, so the sitemap stays at 202 URLs plus the guides (`/guides/<slug>`). When the batch is extended, or all 586 questions get a page after Tim has reviewed the first batch, `/q/<id>` (about 621 URLs in all) replaces more `/game/<id>` entries. The floor test `tests/unit/seo-counts.test.ts` (added by the payments PR #202) must keep passing.
6. **Category pages and SEO list pages list every question**, free and paid, each linking to its `/q/<id>` (S3); the per-question "Play this one" buttons become those links plus one hub button. The free count only governs in-app access.
7. **Kids pages follow the kids rule**: no analytics, no storage writes, no third-party requests, no ads, links only to kids destinations, nothing identifying a visitor. Kids share links keep their bare form (`lib/shareQuestion.ts`: no `link_id` or generation).

Paid and withheld questions are public (Tim: "all withheld paid questions are public"), kids included.

### 1a. First batch (about 100 pages)

Only the questions in the first batch get a `/q/<id>` page, a sitemap entry and a canonical from `/game/<id>` and `/p/<id>`; the rest keep today's behavior until the research expands the list. The list is a frozen file, `lib/seoBatch.js` (explicit ids, never recomputed), and a test fails if an id is not a real question. Criteria, in order:
1. Kids and family first (persona 1 is parents), then adult.
2. Questions already published on the 14 SEO landing pages (they were chosen and tagged by hand).
3. Page priority by the keyword research, then list order within a page; at most 12 per category so every kids category is represented; deduplicated across pages.
4. Free-tier questions only for the first batch, so nothing in it depends on the free-count flip or on a paid question being public.
5. After the research (section 6) the list can be re-ranked and extended by editing the file in a PR.

### 1b. S4 spike result (2026-11-24): keep `/p/<id>` as the share URL

Tried: per-question copies of the app shell at `/game/<id>.html` with that question's OG tags. **Technically feasible**: the exported shell (`dist/game/[id].html`, 28 KB) is client-rendered and its head already uses react-helmet markers (`data-rh`), so a per-id copy with `data-rh` tags works and the app boots unchanged; 586 copies add about 16 MB to the deploy. **But it is not worth it**, because the share URL is also the iOS Universal Link:
- `public/.well-known/apple-app-site-association` claims only `/p/*`, and `lib/universalLink.ts` and `app/+native-intent.tsx` map `/p/<id>` to the game screen. A shared `/game/<id>` link would open in Safari even for a friend who has the app installed. Fixing that means adding `/game/*` to the association file and the native mapping, a change to how links open on iPhones.
- Today's `/p/<id>` already does everything Tim asked for: it unfurls in iMessage and Facebook (OG tags), it sends a web visitor straight into the playable web app, and it opens the installed iOS app.
Recommendation: **keep the Share action on `/p/<id>`; drop S4.** The only SEO work needed is what S2 already does: `/p/<id>` and `/game/<id>` declare `/q/<id>` as canonical, and neither is in the sitemap. If Tim still wants the share URL to be `/game/<id>`, the cost is the per-id shells plus the association-file and native-mapping changes above.

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

## 4. Data from what people select (revised 2026-11-24)

Tim: "this is just an aggregate count that we are keeping in Neon as we get real data (or we can get fake data to bootstrap it and then when we receive meaningful numbers replace it). That is my preference."

Already built: `POST /api/votes` and `GET /api/tallies` keep real aggregate counts per question in Neon (kids votes carry no visitor id). The display rule today (`lib/results.js`, issue #65, spec BR-2): below `VOTE_THRESHOLD` = 20 real votes the app never shows a percentage and never "a made-up split".

**Flag for Tim: showing seeded numbers as "N% chose A" is fabricated social proof.** It contradicts BR-2, and it is a trust risk, an App Review risk (guideline 5.6 on misleading content) and a consumer-protection risk (deceptive claims). Tim accepted keeping seeds OFF for now (decision 2). If seeds are revisited, nothing seeded is shown without a label.

Design if Tim approves seeds:
- **Stored separately.** Real counts stay in the existing tally table and are never written by the seeding. A new table `vote_seeds(question_id, a, b)` holds the prior. Real data cannot be overwritten and is auditable (a query over the real table is always the truth).
- **Blend and handover.** With real counts `ra`, `rb`, `n = ra + rb`, seed shares `pa`, `pb` and prior strength `k = 20` pseudo-votes: shown share of A = `(ra + k*pa) / (n + k)`. The seed is **dropped entirely once `n >= 100`** (5 times the prior): from then on only real counts are shown.
- **Label.** While the seed contributes (`n < 100`) the display says "Based on early votes" and never shows a vote count; from `n >= 100` it shows "N% of <n> votes" with no label. The seed is never counted in any number of votes.
- **Default until Tim answers: no seeds.** Percentages appear only at the existing threshold of 20 real votes, labelled as is today. Seeding code ships off behind a flag.
- Kids: no percentages at all until Tim and legal (#114) say so.
- Open question for Tim: where do seed numbers come from (hand-written guesses are the part that is "fake"; a documented method such as a small survey would be defensible).

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
Plan (budget approved: up to 2,000 credits; persona 1 research done, about 366 credits spent, see `docs/seo/keyword-research-persona1-2026-11-24.md`):
1. Extend the keyword work to the situations above (couples, road trips, icebreakers, family dinner, classrooms) for volume, difficulty and intent: OpenSEO or Semrush keyword research, one call per situation.
2. Competitor question pages: who ranks for "would you rather" plus a topic, whether they have one URL per question, what a page of theirs contains (Semrush organic research and competitor reports; Exa or TinyFish to read two or three pages).
3. Rank personas and situations by demand versus difficulty; that order sets the pillar sequence.
Tools in this account: Semrush MCP, OpenSEO MCP (asks for confirmation above 2,000 credits per batch), Exa and TinyFish for reading pages. Next: research the remaining situations (couples, icebreakers, classrooms) when Tim asks.

## 7. PR plan (separate PRs, none touch payments)

| PR | Change | Notes |
|---|---|---|
| S1 | This design (docs, #207) | Docs only |
| S2 | `/q/<id>`: read-only indexed page for the first batch of about 100 questions (all 586 after Tim has seen it); `/game/<id>` and `/p/<id>` canonical to it; sitemap lists `/q/<id>`; JSON-LD moves; tests: counts floor, no vote control, canonical rules | Unblocks decoupling SEO from the free count |
| S3 | Category pages and SEO list pages list every question and link to `/q/<id>`; list-page "Play this one" removed; `verify-seo` updated | Required (with S2) before 4c flips the free count |
| S4 | **Dropped (spike, section 1b)**: the Share action stays on `/p/<id>`, which already unfurls, enters the web app and opens the iOS app. Revived only if Tim wants `/game/<id>` as the share URL | |
| S5 | Web-only iOS badge, behind `APP_STORE_LIVE` | Flag stays off until the app is public |
| S6 | Related questions, persona copy, cross-links; link-check test (no orphan pages) | |
| S7 | Adult question pages show aggregate results, labelled; seeds off by default and only with Tim's answer | After research and Tim's answer on the flag |
| S8 | First pillar guides under `/guides/` | After the research step ranks the topics |

4c of the payments plan (#124) waits for S2 and S3, so the free-count flip can never shrink SEO.
