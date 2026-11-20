# Kids & family: topic categories, paid unlock, AI "more like this"

Status: spec and plan only, no code. Decisions for Tim: issue #124 (`needs-human`).
Date: 2026-11-20. Inputs: Tim, 2026-11-19 (two messages, verbatim in the issue), the PRD, `docs/payments.md`,
`docs/kids-privacy.md`, `docs/specs/app-store-listing.md`, issue #93, the #112 privacy policy (`app/privacy.tsx`).
The repo has no `CLAUDE.md`; this spec follows the conventions in `docs/`.

## 0. Summary

- Today "Kids & Family" is one category of **223 questions, all free**, with nothing to buy. Tim: that defeats the point,
  and "Family & Kids" is an audience, not a topic.
- Replace it with **8 topic categories plus 1 seasonal category**, named like the adult ones, each labelled with an age
  range. Parents browse them in a separate **"With kids" mode** with an age filter (3–5, 6–9, 10–12, 13–17).
- Each category: **8 free questions**, then a **$1.99 category unlock** (reuses the adult product model; the existing
  $4.99 all-categories pack covers these too). Parental gate before every purchase in "With kids" mode (already built).
- After unlock, **"More like this"** serves new AI-written questions for that category and age range. They are generated
  **server-side in batches into a reviewed pool**, never per child, and fetched as static files with no ID. Cost is under
  $1 per 100 accepted questions; human review of under-13 batches is the real cost.
- Boundary for the no-tracking kids rule: **every category whose youngest age is under 13**. Teen categories (13–17)
  follow the adult rules but keep the purchase gate.

## 1. Audit (as of `main` at aecd745)

### 1.1 What exists

| Item | Number | Where |
|---|---|---|
| Kids & Family questions | **223** (`kf-1`…`kf-223`), all volume 1, all free | `constants/kidsQuestions.ts`, mirrored in `api/_lib/data.js` |
| Adult questions, for comparison | 260 (5 free categories x 40 = 20 free + 20 paid; 5 premium x 20 = 3 free + 17 paid) | `constants/questions.ts` |
| Grouping | One category `kids-family`, `tier: 'free'`. Inside it, questions are grouped only by an SEO `tags` entry naming the landing page they were written for | `constants/kidsQuestions.ts` |
| Products for kids | **None**. `hasPaidContent(kids-family)` is false, so `buildCatalog()` creates no product | `lib/catalog.ts`, `docs/payments.md` |

Questions per SEO tag (all ages ~4–11, light and silly; nothing on feelings, nothing for preteens or teens):

| Tag / landing page | Count | Tag / landing page | Count |
|---|---|---|---|
| `kids` /would-you-rather-questions-for-kids | 25 | `family` /would-you-rather-questions-for-family | 20 |
| `funny` /funny-would-you-rather-questions-for-kids | 20 | `dinner` /dinner-table-conversation-starters | 20 |
| `little` /would-you-rather-questions-for-kindergarten | 20 | `road-trip` /road-trip-would-you-rather-questions | 20 |
| `elementary` /…-for-elementary-students | 20 | `christmas` /christmas-…-for-kids | 18 |
| `this-or-that` /this-or-that-questions-for-kids | 20 | `thanksgiving` /thanksgiving-… | 15 |
| `gross` /gross-would-you-rather-questions | 15 | `app` /would-you-rather-app | 10 |

### 1.2 How kids reach them

- **App and web, category flow:** home → category grid → `/categories/kids-family` → `/game/kf-N?cat=kids-family&idx=…`
  → `/results/kf-N` → `/complete/kids-family`. All 223 are playable in order.
- **Home "random question"** picks from every `tier: 'free'` category, so an adult tapping it can land on a kids
  question (and the reverse cannot be filtered). `app/index.tsx` `handleRandomQuestion`.
- **Web SEO:** 12 kids landing pages list 10–25 questions each and link each to `/game/kf-N`. They show only questions
  that `getAccessibleQuestions(c, false)` returns (`constants/seoPages.ts` `getSeoPageQuestions`).
- **Feed** excludes kids questions (`lib/feedQuestions.ts`, #96). **Share links** `/p/kf-N` exist and carry no IDs.

### 1.3 Where the upgrade flow is missing or broken

1. **Nothing to buy.** `/unlock/kids-family` is reachable by URL and shows the parental gate (`app/unlock/[id].tsx`
   line 173), but there is no product, so the gate guards an empty paywall.
2. **No "more" path at all.** Finishing the category leads to `/complete/kids-family` with no upsell.
3. **Web purchases are simulated.** On web, the paywall's "pay" runs a timer and calls `unlock(id)`
   (`app/unlock/[id].tsx` lines 191–202), which grants paid access for free until the web payments decision (#53).
   This affects adult categories today and would give away any paid kids content on web.
4. **Gating the bank shrinks the SEO pages.** Because `getSeoPageQuestions` only lists free questions, setting a free
   count of 8 would cut every kids landing page from 10–25 questions to at most 8 of its tag (see decision D4).
5. **No age guidance.** One category spans 4–11 with no labels; nothing for 12–17.
6. **Rule keyed to one id.** `isKidsPath()` and `requiresParentalGate()` match the literal `kids-family` category and the
   `kf-` prefix (`lib/kidsPaths.ts`, `lib/parentalGate.ts`, `FAMILY_FRIENDLY`). New category ids must be added there or
   the no-tracking rule silently stops applying.

## 2. Category design

### 2.1 Age bands and how a parent picks one

Bands: **Little ones 3–5 · Kids 6–9 · Preteens 10–12 · Teens 13–17.** Tim suggested six (3–4, 5–6, 7–9, 10–12, 13–14,
15–17); four keeps 2 categories per band with enough questions each. Six bands would mean ~12 thin categories or empty
filters. Each category carries a real range ("Ages 6–12"), so it can sit under more than one band.

**Browse UI (recommended): a separate "With kids" mode.**
- Home gets a two-way switch at the top: **Grown-ups | With kids**. "With kids" shows only kids/teen categories, never an
  adult card (Midnight Secrets, Moral Compass…). Grown-ups mode no longer shows any kids card.
- Inside "With kids": a row of age chips (**All · 3–5 · 6–9 · 10–12 · 13–17**). A chip filters cards whose range overlaps
  the band. Each card shows its age range under the name.
- The chosen chip and mode are held in memory only (no storage on kids routes; see §5). Default: All.
- "Random question" in each mode draws only from that mode's categories (fixes §1.2).

Rejected: one mixed grid with labels (adult and kids cards side by side on a screen a child holds); an age picker that
asks the child's age first (an extra step, and asking a child's age is a data question we don't want to raise).

### 2.2 The categories

Free count **8** per category (one car ride or dinner; adult premium gives 3, adult free gives 20). Paid unlock: every
written question in the category beyond the first 8, new written questions added later, and AI "more like this".

| # | Category | Emoji | Ages | One line | Example questions | Existing → target written |
|---|---|---|---|---|---|---|
| 1 | **Tiny Choices** | 🐣 | 3–5 | Easy picks for little ones: animals, colours, snacks, play. | Be a puppy or a kitten? · Splash in puddles or jump in leaves? | 20 → 30 |
| 2 | **Make-Believe** | 🏰 | 4–8 | Magic, superpowers, castles, dragons and faraway worlds. | Fly or turn invisible? · A pet dragon the size of a cat, or a cat the size of a dragon? | 41 → 41 |
| 3 | **Giggle Factory** | 😂 | 5–10 | Silly, kid-safe gross, quick this-or-that. | (from the funny / gross / this-or-that sets) | 55 → 55 |
| 4 | **Road Trip Rally** | 🚗 | 4–12 | Made for the back seat. | A car that drives underwater or flies over traffic? · Pick the music or the snacks for the whole trip? | 20 → 30 |
| 5 | **Dinner Table** | 🍽️ | 6–12 | Family life, school, home: easy to answer, easy to ask "why?". | Switch jobs for a day or switch bedrooms for a week? · Recess all day or art class all day? | 47 → 47 |
| 6 | **Heart to Heart** | 💛 | 7–12 | Friendship, kindness, brave moments, big feelings. Calm enough for bedtime. | Famous for being kind or for being brave? · Plan a surprise for someone or get one? | 3 → 30 (new writing) |
| 7 | **Future Me** | 🚀 | 11–17 | Growing up, dreams, careers, what kind of person to be. | Detective who solves mysteries or scientist who cures diseases? · (new) Know your job at 12 or try ten jobs by 25? | 4 → 30 (new writing) |
| 8 | **Real Talk** | 💬 | 13–17 | Friends, school, phones, independence. Light enough to start, real enough to keep going. | (new) Lose your phone for a week or your weekend plans for a month? · (new) Always know when a friend is upset, or always know what to say? | 0 → 30 (new writing) |
| S | **Holiday Table** | 🎄 | 4–12 | Thanksgiving, winter holidays, birthdays. Seasonal. | (from the christmas / thanksgiving sets) | 33 → 33 |

Totals: 223 existing retagged (20+41+55+20+47+3+4+33), about 73 new written to fill thin categories before launch.
Free: 9 x 8 = **72** (down from 223). Paid written: about 224, plus AI.

Retag rule (default by SEO tag, then per-question review in Unit 1):
`little`→Tiny Choices; `kids`, `app`, and `elementary` 66/72/75/79/82/85→Make-Believe; `funny`, `gross`,
`this-or-that`→Giggle Factory; `road-trip`→Road Trip Rally; `family`, `dinner` (minus 178/188/189) and the other 10
`elementary`→Dinner Table; `dinner` 178/188/189→Heart to Heart; `elementary` 68/71/81/83→Future Me;
`christmas`, `thanksgiving`→Holiday Table. The free 8 per category are hand-picked starters, not the first 8 by id.

IDs: question ids never change (votes and share links key on them). Under-13 categories keep the `kf-` prefix
(`kf-224…` for new writing, `kf-ai-…` for AI); teen categories use `tn-` (`tn-1…`, `tn-ai-…`). The `tags` field stays,
so SEO pages keep their own questions.

### 2.3 Data model change

`CategoryDef` gains `audience: 'adult' | 'kids' | 'teen'` and `ages: [min, max]`. `kids` = min age under 13. `kids-family`
is removed; `/categories/kids-family` redirects to "With kids" mode. `FAMILY_FRIENDLY`, `isKidsPath()` and
`requiresParentalGate()` derive from `audience`, not a literal id, with a unit test that fails if any `kids` category is
missing from the kids-route set.

## 3. Upgrade path

### 3.1 Flow (mirrors the adult unlock)

1. Category screen: 8 playable questions, then the locked rows ("👑 N more · Unlock") already used by adult categories.
2. Question 8's result screen and `/complete/<id>` show "Want more [Category]? Ask a grown-up" → `/unlock/<id>`.
3. `/unlock/<id>`: **parental gate first** (existing `ParentalGate`), then the paywall: price, "includes new questions
   added over time and More like this", "Unlock everything $4.99", Restore Purchases. No analytics on this path.
4. After purchase: back to the category, all written questions open, plus a **More like this** button at the end.

Web: until #53 decides web payments, **the web paywall must not grant anything.** Recommended: on web, kids paywalls
show "Unlock in the iPhone app" behind the parental gate (a link out also needs the gate) and the simulated sheet is
removed for kids categories; fix it for adult categories in #53. This is a prerequisite for Unit 3.

### 3.2 Who pays, and the gate

A parent pays. Every purchase screen and every link out reached from "With kids" mode (kids **and** teen categories)
shows the existing gate (`lib/parentalGate.ts`: a three-number sum such as 27 + 31 + 6, a new one after a wrong answer).

Apple: guideline **1.3 (Kids Category)** requires a parental gate before purchases and links out; guideline **5.1.4**
covers apps aimed at children wherever they are listed (no third-party analytics or ads in kids-directed parts, COPPA).
We are a general listing at 13+ (Tim, 2026-11-19), so 1.3 does not formally apply, but App Review applies its spirit to
kids-directed sections, and our review notes already promise the gate. Verify the current guideline text when filing;
Apple's page was not retrievable in this session (same caveat as the listing spec). Apple's own Ask to Buy also stops a
child's Family Sharing account from buying without approval, independent of our gate.

### 3.3 RevenueCat products and entitlements

Reuse the model: one non-consumable per category, `wyr_unlock_<id>` → entitlement `cat_<id>`, in the `default`
offering; `premium_all` opens every category including these (the access rule in `lib/catalog.ts` already does this).
New iOS products: **9** (8 topic + Holiday Table), catalog 8 → 17. `buildCatalog()` picks them up automatically once
they have paid content; `npm run rc:sync` creates them in the Test Store; App Store Connect products are created by Tim
(go-live is Tim's, per `docs/payments.md`).

Pricing options (decision D2):

| Option | Per category | Bundle | Notes |
|---|---|---|---|
| **A (recommended)** | $1.99 | existing **$4.99 all-categories** pack covers adult + kids | No new bundle; same mental model as adult; fewest products. A parent who wants "all kids" pays $4.99 and also gets adult categories (harmless; they are already viewable). |
| B | $1.99 | new **"With kids" pack $3.99** (`wyr_family_all` → `family_all`) | Clearer for parents who never use adult mode; one more product and one more access rule. |
| C | $0.99 | $2.99 kids pack | Higher conversion, lower revenue per buyer; breaks price parity with adult. |

Not recommended: a subscription. AI cost per family is cents (§4), and a subscription on a kids-facing screen adds
review scrutiny for little gain.

Restore: the existing Restore Purchases button on the paywall, unchanged. Entitlements refresh on app foreground.

**Payments changes need Tim's review before merge** (Units 3 and 4 below; also any change to `lib/catalog.ts`,
`app/unlock/[id].tsx`, `contexts/UnlockedContext.tsx`, or RevenueCat/ASC products).

## 4. AI "more like this"

### 4.1 Shape: pre-generated, reviewed pool per category

Tim wants "AI spins off and generates them". The parent sees exactly that: after unlock, More like this keeps serving new
questions. Under the hood, generation runs **server-side, in batches, into a per-category pool**, not once per child:

- A scheduled job (Vercel cron, `api/cron/kids-pool.js`) checks each category's pool. When fewer than **50 unserved
  approved** questions remain, it generates a batch of 50 candidates.
- Candidates pass the safety pipeline (§4.3) and land as `draft`. Under-13 drafts need human approval; teen drafts
  auto-publish after the pipeline (decision D5).
- Approved questions are written to static files `/kids-pool/<category>.json` (CDN, no cookies, no query string).
- The app fetches that file on More like this. Locks are enforced on the device, the same way locked written questions
  already ship in the bundle today. No entitlement check reaches our server, so no RevenueCat ID is sent from a kids
  screen. Leak risk equals today's (locked text is in the bundle).

Why not live generation per tap: unreviewed output in front of a 6-year-old, a third-party call in the kids path, cost
and latency that scale with use, and a server-side entitlement check that would need a persistent ID from a kids route.

### 4.2 Model and prompt

- **Generation: `claude-opus-5-5`** (current default; $4 / $20 per 1M tokens), adaptive thinking, effort `low`,
  structured output `{questions: [{optionA, optionB, ages}]}`. Haiku 5.5 ($0.10 / $0.50) is the fallback if Opus quality
  is not needed; compare on one batch per category first.
- **Classifier: `claude-sonnet-5-5`** ($2 / $10), a separate call, structured verdict per question.
- Prompt (system, cached): the category's name, one-line brief, age range, tone rules from the bank header ("no
  romance, no violence, no brands, nothing scary, nothing that singles out a body or a family situation"), reading
  level for the age, 20 approved questions from that category as examples, and the list of existing option texts to
  avoid duplicates. User turn: "Write 50 new questions for [category], ages [x–y]". **No user or child data is ever in
  the prompt:** the input is category metadata and existing questions only.
- Topic and age are enforced three ways: prompt, a classifier check ("fits the topic? fits ages x–y?"), and a
  reading-level check (Flesch-Kincaid grade ≤ age − 3 for under-13 bands).

### 4.3 Kids-safety filtering

1. **Blocklist** (deterministic, before and after the model): violence, weapons, death, romance/dating/kissing (under
   13), body shape and weight, brands, real people, religion, politics, medical, scary themes, money pressure, personal
   info prompts ("what's your address"). Kept in `lib/kidsBlocklist.ts`, unit-tested.
2. **Classifier pass** (Sonnet 5.5): pass/fail per question with reasons: safe for the age, on topic, not
   embarrassing or singling out (e.g. "would you rather have no friends"), both options acceptable to say aloud,
   no duplicate of an existing question. Any fail is dropped, not edited.
3. **Human-reviewable log**: every candidate, verdict and reason in a `kids_pool` table (Neon, already used for votes):
   `id, category, optionA, optionB, ages, model, prompt_version, classifier_verdict, reasons, status
   (draft|approved|rejected|retired), reviewed_by, created_at`. An owner-only review page (`/owner/kids-pool`, behind
   the existing owner access) lists drafts with approve/reject in bulk. A "report this question" link on paid questions
   (behind the parental gate, sends only the question id) retires it on the next publish.

### 4.4 Cost per 100 questions

Assumptions per batch of 50 candidates: ~6,000 input tokens (system, examples, dedupe list), ~2,000 output plus
~4,000 thinking at low effort; classifier ~4,000 in / ~3,000 out; 60% of candidates survive.

| Step | Per 100 candidates | Per 100 accepted |
|---|---|---|
| Generation, Opus 5.5 | ~$0.29 | ~$0.48 |
| Classifier, Sonnet 5.5 | ~$0.08 | ~$0.13 |
| **Total** | | **~$0.61** (~$0.31 with the Batch API, which suits a cron job) |
| All-Haiku 5.5 alternative | | ~$0.02 |

Seeding 100 extra per category (9 categories) costs about $6; a year of refills at 50/category/month is under $50 even
at 5x these estimates. **Money is not the constraint; Tim's review time is** (about 10 minutes per 50 under-13 drafts).

### 4.5 Rate limits, caching, offline

- Generation is bounded by the cron, not by users: max 1 batch per category per day, monthly spend cap enforced in the
  job (stop at $20/month, alert via the daily report). No per-user rate limit is needed because users never trigger a
  model call.
- Caching: generate once, serve forever to every family; prompt caching on the system block across the 9 categories.
- Offline / no network: the app ships the written paid questions in the bundle, so an unlocked category still plays.
  More like this shows "New questions need a connection" and falls back to replaying the category. The last fetched
  pool file is kept in the HTTP cache only.
- "Seen" tracking: the kids rule forbids storing kids progress. Recommended (decision D6): allow one device-local,
  never-sent number per category ("next pool index"), which is not an identifier. Without it, More like this starts at a
  random point each visit and will repeat.

### 4.6 Key and kids rule

- Key: the Anthropic key from #93, stored as `ANTHROPIC_API_KEY` in **Vercel server env only** (used by the cron job),
  never `EXPO_PUBLIC_*`, never in the app. Requested through the credential form, never in chat. Note #93 planned a
  build-time-only key; this extends it to a server-side cron. No user-facing route calls the model.
- Kids rule compliance: the model receives no child data, no IDs, no votes, no device info. Kids routes make one new
  request: `GET /kids-pool/<category>.json`, no query string, no cookies. Votes on pool questions (`kf-ai-*`) follow the
  existing `kf-` rule (no visitor ID, nothing stored on device). The votes API must accept pool ids (read the same pool).
  `tests/browserless/kids-no-tracking.mjs` gets this one URL pattern added to its allowlist and nothing else.

## 5. Kids-rule boundary, 13+ rating, privacy and listing

### 5.1 Boundary (decision D3)

**Recommended: the no-tracking rule covers every category with `audience: 'kids'` (youngest age under 13).** That is
categories 1–7 and Holiday Table (Future Me starts at 11, so it counts as kids). Only Real Talk (13–17) is a teen
category; it follows the adult rules (PostHog on, visitor ID allowed). Reason: COPPA's line is 13, and the app is rated 13+.
Purchase gate: all of "With kids" mode, teen included.

Alternative: treat all of "With kids" mode as kids routes. Simpler to explain and safest, but no data at all on teen
categories, which is where we would learn about the 13–17 audience.

13+ rating: the new categories add no mature content; the rating stays 13+ (Apple computes it). A 13+ app cannot be
installed on a child's device with Screen Time age limits, which fits "parents use it" but means under-13 content is
used on a parent's phone. Re-run the age-rating audit only if teen questions touch dating or substances (they must not).

### 5.2 Privacy policy changes (`app/privacy.tsx`)

- Rename "Kids & Family" to "categories for children under 13 (shown in With kids mode)" and keep the same promises.
- Add: "Some paid questions are written with the help of an AI model (Anthropic's Claude). The model is given only our
  category descriptions and existing questions, never anything about you or your child. Every question for children
  under 13 is reviewed by a person before it appears."
- Add: "With kids mode loads new questions from our server as a plain file; no ID is sent."
- If D6 is approved: "The app remembers on your device how far you have got in each category. It is not sent anywhere."
- Teen categories: covered by the existing general section (analytics on), stated explicitly.

### 5.3 App Privacy labels (`docs/specs/app-store-listing.md` §5.3)

No new data type is collected: the AI pipeline uses no user data, the pool fetch carries no identifier, purchases are
already declared. Labels unchanged. Update the listing text ("Kids & Family is free" → "family categories with free
questions and an optional unlock") and the review notes (paths for the gate: any category in With kids mode → Unlock).
Keep "kids" out of the app name/subtitle/keywords (guideline 2.3.8, per the listing spec).

### 5.4 PRD changes (proposed; Tim applies or rejects)

These should go into the PRD as blue text with a comment each. They are not inserted: the available Drive tool cannot
add coloured text or comments without rewriting the document, which would break "never edit the body".

1. Personas → Parents with Young Kids, after "age appropriate": *"Kids content is organised as topic categories with an
   age range (3–5, 6–9, 10–12, 13–17), browsed in a separate With kids mode. Each category has 8 free questions; a parent
   can unlock the rest for $1.99 behind a grown-ups-only check."* Comment: Tim 2026-11-19, "Family and kids is a
   demographic, not a category."
2. User story 6 (struck) → add: *"After unlocking a category, More like this gives me new questions in the same topic
   and age range, written with AI help and screened (people review every question for under-13s) before they appear."*
   Comment: restores the AI-generation intent from the original summary, now with review.
3. Summary: replace "AI-generated custom packs come after the MVP" with *"AI-extended categories ship with the kids
   categories; custom categories come later."*

## 6. Phased build plan

| Unit | PR | Files it owns | Tim review? | Verifiable by |
|---|---|---|---|---|
| 0 | This spec | `docs/specs/kids-family-categories.md` | Decisions only | Read |
| 1 | Content: categories, retag, hand-pick free 8, write ~73 new questions | `constants/kidsQuestions.ts` (split per category file if large), `api/_lib/data.js`, `scripts/verify-questions.ts` (new checks: every kids question in exactly one category, free count 8, ages set, blocklist clean) | **Yes**: read every new question (73) | `npm run verify:data`, `npm test` |
| 2 | Model + kids-rule plumbing: `audience`, `ages`, remove `kids-family`, redirect, derive `isKidsPath`/`requiresParentalGate`/`FAMILY_FRIENDLY` from `audience` | `constants/questions.ts`, `lib/kidsPaths.ts`, `lib/parentalGate.ts`, `constants/seoPages.ts` (D4), `tests/unit/*` | No (privacy rule, but no payments) | unit tests incl. "every kids category is a kids route"; `tests/browserless/kids-no-tracking.mjs` on every new route |
| 3 | Browse UI: Grown-ups / With kids switch, age chips, age label on cards, mode-scoped random | `app/index.tsx`, `app/categories/index.tsx`, `components/CategoryCard.tsx` | No | screenshots at phone width; navigation test |
| 4 | Payments: 9 products, catalog sync, paywall copy, gate on every With kids purchase and link out; web kids paywall shows "unlock in the app" (no simulated grant) | `lib/catalog.ts`, `app/unlock/[id].tsx`, `scripts/revenuecat/sync-catalog.ts`, `docs/payments.md` | **Yes (payments)** | `npm test` (catalog has 17 products), `npm run rc:sync` twice (idempotent), DEVICE rows 7–15 of the payments test plan per new category |
| 5 | AI pipeline (server): blocklist, generator, classifier, `kids_pool` table, cron, publish to `/kids-pool/*.json`, owner review page | `lib/kidsBlocklist.ts`, `api/cron/kids-pool.js`, `api/_lib/pool.js`, `db/migrations/*`, `app/owner/kids-pool.tsx`, `vercel.json` | **Yes** (key, spend cap, first batch review) | unit tests with a fake model client; dry run on one category; Tim approves the first 50 |
| 6 | More like this (client) + votes accept pool ids + report link | `app/complete/[id].tsx`, `app/categories/[id].tsx`, `lib/pool.ts`, `api/_lib/votes.js`, `tests/browserless/kids-no-tracking.mjs` | **Yes** (touches the paid surface) | kids-no-tracking test passes with only the pool URL added; offline check |
| 7 | Privacy policy, listing kit, review notes, PRD | `app/privacy.tsx`, `docs/specs/app-store-listing.md`, `docs/kids-privacy.md` | **Yes** (policy text) | `tests/unit/legal-pages.test.ts` |

Order: 1 and 2 together are shippable alone (clear categories, free tiers, nothing for sale yet, SEO decision applied).
3 next. 4 needs #53's web decision for the web half. 5–6 after 4. 7 must merge before or with 4 reaching the App Store.

## 7. Risks and blind spots

- **SEO vs paywall (D4).** The biggest trade-off. Kids landing pages drive the funnel; gating their questions cuts their
  content by up to two thirds. Recommended: keep SEO pages listing their full written set as free single questions
  (they are already public and indexed), and gate the in-app category run, new writing and AI. Honest cost: a
  determined parent can play the 223 via landing pages. The paid value is the continuous, age-matched category plus new
  questions, not the old lists.
- **Content gaps are real work.** Heart to Heart, Future Me and Real Talk barely exist today. Shipping them thin (fewer
  than 20) makes the unlock feel empty. Write before selling.
- **Teen tone is different.** "Real Talk" written by the same voice as Giggle Factory will read as childish to a 15-year
  old. Tim (or a teen) should read a sample before launch.
- **Web gives paid access away today** (§1.3.3). Fix before any kids product exists.
- **Free count.** 8 is a guess. Measure unlock rate per category; consider 5 for categories with long tails.
- **Highest leverage:** Units 1–3 (clear, age-labelled categories) improve the parent experience even if nobody pays;
  the AI pipeline is worth building only after Unit 4 shows parents buy the written unlock.
