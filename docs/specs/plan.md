# Product plan

A short, readable plan for what we are building and in what order. Each item links to its issue and spec.
Keep it current: when a unit ships or the order changes, edit it here.

## Now: kids and family categories (#124)

**Why.** "Kids & Family" is one category of 223 questions, all free. Tim (2026-11-23): it "is not a useful category",
and "having a free category with a hundred questions will reduce monetization". Family and kids is an audience, not
a topic.

**Pricing (Tim, 2026-11-24):** 8 free per category, then each $1.99 purchase opens the next 20 questions of that category, repeatable until it is exhausted. This replaces the "$1.99 unlocks a whole category" model for kids categories.

**What.** Replace it with eight topic categories (Tiny Choices, Make-Believe, Giggle Factory, Road Trip Rally,
Dinner Table, Heart to Heart, Future Me, Real Talk) and one seasonal one (Holiday Table). Each shows an age range.
Each has 8 free questions; after that each $1.99 purchase opens the next 20 (spec §3.4, decided: Tim accepted its
five defaults on 2026-11-24). After unlocking, "More like this" serves new AI-written questions that a person has reviewed.

**Rules that do not change.** Nothing under 13 is tracked and no ID is stored on a kids route. Every purchase from
the kids side sits behind the parental gate. Question ids never change.

**Order.** Spec: `docs/specs/kids-family-categories.md` §6. Issue: #124 (PRD and acceptance tests).

| Unit | What | Review |
|---|---|---|
| 1 | Content: the 9 categories, retag the 223 existing questions, hand-pick the free 8, write 103 new ones. **Merged 2026-11-24** after Tim read all 103 | Done |
| 2 | Data model: `audience` and `ages` on every category; the kids rules derive from `audience`. **Merged 2026-11-23** | Done |
| 3 | Browse UI: Grown-ups / With kids switch, age chips, age label on each card. **Merged 2026-11-24** (PR #198; works with tranches, it shows no price) | Done |
| 4 | Payments: tranche products, With kids pack, paywall, parental gate on every purchase. Tim accepted all five tranche defaults on 2026-11-24. **Plan below; in progress as separate PRs** | Tim reviews every PR, none auto-merged |
| 5 | AI pool (server): safety filter, generator, review queue, cached endpoint | Tim reviews, approves the first batch |
| 6 | More like this in the app, reports | Tim reviews |
| 7 | Privacy policy, kids counters, listing and review notes, Smart App Banner | Tim reviews the policy text |

Units 1 to 3 are on `main`. Questions 9 onward in each kids and teen category are locked, but no product exists to
unlock them yet (the catalog derives 9 category products that were never created; the two tests that pin the old 8
products fail on purpose, see the PRD on #124). Unit 4 must land before kids unlocks can be sold. Units 5 and 6 wait
until Unit 4 shows parents buy the written unlock.

### Unit 4 build plan

**Decided (Tim, 2026-11-24, "accept all five tranche defaults"; spec §3.4):**
1. The $4.99 all-categories pack stays for adult categories only. A separate With kids pack is added; kids and teen tranches are not covered by the $4.99 pack.
2. Adult categories stay as they are (their 17 to 20 paid questions are already one tranche).
3. A remainder under 10 questions merges into the previous tranche. No new questions are written now.
4. One non-consumable product per tranche (12 products, restorable).
5. The 20 questions in each tranche come in current id order. Tim may curate later.

**Flagged assumptions (not Tim's words, confirm before the store has them):**
- The With kids pack price is **$9.99** (the orchestrator's default).
- Names: product `wyr_premium_kids`, entitlement `premium_kids`.
- Tranche ids: product `wyr_unlock_<category>_<k>`, entitlement `cat_<category>_<k>`, `k` from 1. Same shape as today.
- Teen (Real Talk) is sold like the kids categories (tranches plus the With kids pack, behind the gate).

**The 12 tranches** (paid questions per category; free 8 first): Tiny Choices 22 (1); Make-Believe 33 (20, 13); Giggle Factory 47
(20, 27); Road Trip Rally 22 (1); Dinner Table 39 (20, 19); Heart to Heart 22 (1); Future Me 22 (1); Real Talk 22 (1); Holiday Table
25 (1). Product count after Unit 4: 8 today, plus 12 tranches, plus the With kids pack = **21**.

**Rule.** Every payments change is its own PR. They are never batched, none is auto-merged, and each goes to Tim's queue with a link and
one line on what a user would notice. No App Store Connect product, and no RevenueCat product, is created without asking the orchestrator
first. The CI that creates products (`apple-iap-create`, `apple-iap-review-screenshot`) is never run by the build.

| PR | One change | What a user would notice | Tests |
|---|---|---|---|
| 4a | Pure model. `lib/tranches.ts` (sizes, remainder rule, `trancheOf`, `isQuestionOpen(category, index, access)`, `nextTrancheToSell`), tranche and kids-pack ids in `lib/catalog.ts`, `premium_all` stops opening kids and teen categories, and its title and description change to say adult categories (catalog and store file; flagged wording "All Grown-up Categories" / "Every adult category, plus future questions"). **Gate before 4a ships: confirm no real `wyr_premium_all` purchase exists, else grandfather.** `access` is `{ all: boolean; ownedTranches: ReadonlySet<number> }` (a set, never a count or prefix), and an adult category is one tranche, granted by the existing `cat_<id>` entitlement (never `cat_<id>_1`), with the free count always from `getFreeQuestionCount` (3, 8 or 20 by category), never a hardcoded 8; a 4a test pins both for every adult category. **4a adds the tranche-aware helpers alongside the existing boolean `isQuestionLocked` and `getAccessibleQuestions`, which stay unchanged**, so every current caller still compiles and 4a passes typecheck and CI on its own. No screen changes behavior for adults. | Nothing. | New `tranches.test.ts`; `catalog.test.ts` moves to 21 products; an adult-regression test pins that every adult category still unlocks exactly as before. |
| 4b | Context and screens read per-tranche access. `UnlockedContext` exposes `accessFor(id)` (the `access` value above, built from entitlements) (owner access, which is for the owner and testers, still opens everything. **4b leaves the temporary web free unlock (`WEB_FREE_UNLOCK`, Tim's "128 b") behaving exactly as today**; it is narrowed in 4c, in the same PR as the paywall change, so a kids paywall button never does nothing between two deploys); every caller moves to the tranche-aware helpers: `app/index.tsx`, `app/categories/[id].tsx`, `app/complete/[id].tsx`, `app/feed/index.tsx`, `app/game/[id].tsx`, `app/kids/index.tsx`, `app/results/[id].tsx`, `app/settings.tsx`, `lib/nextCategory.ts`, and the two SEO scripts `scripts/generate-sitemap.ts`, `scripts/verify-seo.ts` and `constants/seoPages.ts` (`getSeoPageQuestions`, lines 590 and 599). The scripts and `seoPages.ts` are the guards that keep locked question text out of the sitemap, JSON-LD and the adult SEO landing pages: each passes an explicit no-purchase `access` (`{ all: false, ownedTranches: new Set() }`), never `all: true` and never a local boolean shortcut, and a test pins that for every one of them. The list above is a starting point, not the contract: the contract is that **no reference to the old boolean `isQuestionLocked` / `getAccessibleQuestions` remains anywhere** (a test greps the code directories `app/`, `lib/`, `constants/`, `contexts/`, `components/`, `hooks/`, `scripts/` and `tests/`, the test files included: `tests/unit/kids-categories.test.ts` lines 52 and 147 move too; docs under `docs/` are excluded from the grep and 4b updates the ones that name the old helpers, `docs/seo.md` and spec §3.4 and its old text, by hand), and typecheck is green. Then the old helpers and the deprecated `isPremiumGated` wrapper in `constants/questions.ts` are deleted (nothing outside `questions.ts` uses `isPremiumGated`). | Nothing for adults. An owned kids tranche opens that tranche's questions (its real size). | Updated call-site tests; kids no-tracking browser test unchanged. |
| 4c | Paywall. `app/unlock/[id].tsx` offers only the **next** tranche ("Open the next {n} questions · $1.99" with `{n}` the tranche's real size, 20, 22, 13, 27, 19 or 25, and how many remain), the With kids pack on kids and teen paywalls, the parental gate on every kids or teen purchase, "Unlock in the iPhone app" on web, and **in the same PR the web free unlock becomes adult-only**: `accessFor(id)` returns `all: true` from a free unlock only for adult categories, the free CTA and `unlock(id)` / `unlockAll()` calls are removed from kids and teen paywalls (`app/unlock/[id].tsx` `WEB_FREE_UI` path), so a stored `premium_all` or per-category free unlock never opens a kids or teen tranche (spec §3.4 and §3.1). A test pins it, including a stored `premium_all` on a kids category. | A kids paywall that sells the next tranche of questions (its real size, shown on the button). | Paywall copy and gate tests; browser run of the kids paywall with no tracking. |
| 4d | Store files. `store/ios/iap-products.json` and `store/ios/iap.md` gain the 13 products and the `wyr_premium_all` name and description say adult categories; `scripts/revenuecat/sync-catalog.ts` and `scripts/render-iap-review-screenshots.mjs` handle tranche ids; the `CREATE-8-IAPS` confirmation becomes `CREATE-21-IAPS`. Review screenshots are rendered from 4c's paywall and committed. **Nothing is run against App Store Connect or RevenueCat.** | Nothing. | `asc-iap-create.test.ts` parity and `asc-iap-review-screenshot.test.ts` go green. |
| 4e | Create the products. Only after the orchestrator says go and Tim has confirmed the With kids price: dry run of the create workflow, then the apply. | Kids tranches become buyable on iOS. | Dry-run output attached. |

The two tests that fail on purpose today (`catalog.test.ts` product count, `asc-iap-create.test.ts` parity) are fixed by 4a and 4d. The
review-screenshot test is expected red between 4a and 4d for the new products only, because the screenshots need 4c's paywall.

**Open risks.**
- 4b touches the access rule everywhere. Adult behavior must not change; 4a's regression test and a full `npm test` guard that.
- A tranche bought out of order (restore, refund, a promo) must not hide a question the player owns or open one they do not: access uses the set of owned tranches, never a count or prefix. Example pinned by a 4a test: Giggle Factory with tranche 1 refunded and tranche 2 owned opens exactly tranche 2's 27 questions, and the paywall offers tranche 1 (the lowest not owned).
- Refund of a tranche closes only that tranche. The listener already revokes on the next fetch.
- Family Sharing is off for all products today (`familySharable: false`); that stays unless Tim asks.

## Now: one free-count rule for every category (#238)

**Why.** Tim (2026-11-25): "i've removed the concept of an entirely free category. we've now made consistent across all
categories, they have a fixed number that is free and the additional 20 they have to pay an upgrade. so i believe we said
it was 5 free, so that means there are no longer any that have just completely 20 or more free". Today Moral Compass, Social
Blunders, Career Climber and Tech Dystopia are `tier: 'free'` (20 free, 20 paid) and the other five give 3 free.

**Rule (Tim, 2026-11-25, option C in #238).** No free tier. One free count `F`, then paid tranches: "each unlocked scope within a single
category is just an additional 20 questions capped, no matter what the category". **Free count `F = 5` is not yet confirmed**: Tim wrote
"i believe we said it was 5", and nothing in the repo says 5 (code: 3 and 8). No app code until the orchestrator confirms it.
Labels, paywall, store text and docs derive from the tranche function, never from a typed number.

**Tranche function.** `tranches(category)`: with `n` questions in category order and `F = getFreeQuestionCount(category)`, tranche `k` (1-based)
holds positions `F + 20(k-1) + 1` to `min(F + 20k, n)` (1-based). A remainder under 10 joins the previous tranche (the kids rule in
`docs/specs/kids-family-categories.md` §3.4; no grown-up remainder is under 10). Free = positions 1 to `F`. Computed from the data on main (`npx tsx` over
`getCategoryQuestions`, 2026-11-25), `F = 5`:

| Category | n | Free | Tranche 1 | Tranche 2 |
|---|---|---|---|---|
| The High Life | 20 | 1-5 (hl-1..hl-5) | 6-20, 15 questions (hl-6..hl-20) | none |
| Midnight Secrets | 20 | 1-5 | 6-20, 15 (ms-6..ms-20) | none |
| Time Traveler | 20 | 1-5 | 6-20, 15 (tt-6..tt-20) | none |
| Deep Desires | 20 | 1-5 | 6-20, 15 (dd-6..dd-20) | none |
| Wildest Dreams | 20 | 1-5 | 6-20, 15 (wd-6..wd-20) | none |
| Moral Compass | 40 | 1-5 (mc-1..mc-5) | 6-25, 20 (mc-6..mc-25) | 26-40, 15 (mc-26..mc-40) |
| Social Blunders | 40 | 1-5 | 6-25, 20 (sb-6..sb-25) | 26-40, 15 (sb-26..sb-40) |
| Career Climber | 40 | 1-5 | 6-25, 20 (cc-6..cc-25) | 26-40, 15 (cc-26..cc-40) |
| Tech Dystopia | 40 | 1-5 (td-1..td-5) | 6-25, 20 (td-6..td-25) | 26-40, 15 (td-26..td-40) |

Tranche 1 of the four 40-question categories crosses the old volume boundary (positions 21-25 are volume 2); `volume` stops mattering for access.

**Products.** Tranche 1 keeps today's ids: `wyr_unlock_<category>` / entitlement `cat_<id>` (so nothing that exists changes id; only its text and the
questions it opens change). Tranche 2 follows the kids pattern `wyr_unlock_<category>_<k>` / `cat_<id>_<k>`. Four new products, $1.99 each (price is
an assumption; Tim approved $1.99 for the old per-category unlock): `wyr_unlock_moral_compass_2`, `wyr_unlock_social_blunders_2`,
`wyr_unlock_career_climber_2`, `wyr_unlock_tech_dystopia_2`. Catalog grows from 8 to 12 grown-up products (iOS v1; Midnight Secrets and Deep Desires
stay out of iOS v1, so only 7 of the 9 categories sell there).

**`wyr_premium_all`** ($4.99) opens every tranche of every grown-up category, including tranches added later (as `docs/specs/kids-family-categories.md` §3.4 already decided: it does not open kids or teen tranches).

**Kids.** Kids and teen tranches are already specified (§3.4; 12 products, `F = 8`, same 20-question step, remainder under 10 merges) and are Unit 4, not built
(`lib/tranches.ts` does not exist on main). One function serves both: only `F` and the entitlement id differ (grown-up tranche 1 keeps the legacy
`cat_<id>`). Whether kids move to `F = 5` is Decision 3 in #238.

**Creating a product without a write by the Apple ops key.** The Apple ops workflow is read-only and stays so. Two ways to create the four products,
both Tim's: (1) by hand in App Store Connect: app > Monetization > In-App Purchases > "+" > Non-Consumable, product id, $1.99, en-US text, review screenshot; or (2) the existing
`Apple IAP create` workflow (`apple-iap-create.yml`, dry run first, then `apply=true` with its confirm string, which is hard-coded `CREATE-8-IAPS` and must change to the new count in a
separate PR). Note both use the same `ASC_*` secrets; only workflow (2) writes. RevenueCat products, entitlements and packages come from `npm run rc:sync` (Tim runs it; I never do) or the RevenueCat dashboard.

| Step | What | Files |
|---|---|---|
| F1 | Rule and tests: `FREE_QUESTION_COUNT`, `tier` split removed for grown-ups, `tests/unit/free-count.test.ts` | `constants/questions.ts`, tests |
| F2 | Labels and paywall: no FREE pill, one paywall copy, derived counts, random play uses every category | `app/index.tsx`, `app/categories/*`, `app/unlock/[id].tsx`, `app/game/[id].tsx`, `app/results/[id].tsx`, `app/complete/[id].tsx`, `components/CategoryCard.tsx`, `constants/copy.ts`, `lib/nextCategory.ts` |
| F3 | SEO per Tim's answer | `constants/seoPages.ts`, `scripts/verify-seo.ts`, sitemap |
| F4 | Store text and docs | `store/ios/*`, `docs/specs/app-store-listing.md`, `docs/specs/kids-family-categories.md` |
| F5 | Payments, one PR: tranche function and access by owned tranche set, the 4 `_2` products in the catalog, new paywall text ("Open the next {n} questions") | `lib/catalog.ts`, `constants/questions.ts`, `store/ios/iap-products.json`, `app/unlock/[id].tsx`; App Store Connect and RevenueCat creation are Tim's |
| F6 | Review screenshots re-rendered if the paywall changes | `store/ios/iap-review/` |

**Buyers.** None known: RevenueCat revenue is $0 over 28 days, the iOS app is unreleased, web unlocks for free. Existing product ids and entitlements keep their ids; tranche 1 of a 40-question category now opens positions 6 to 25, not all 40, so
the four existing `wyr_unlock_*` products change text (`READY_TO_SUBMIT`, never approved) and four `_2` products are added (separate PR).

**Acceptance tests for the tranche rule** (`tests/unit/tranches.test.ts`, run `npx tsx --test tests/unit/tranches.test.ts`; plus device checks):
1. For each grown-up category the tranche table above is reproduced exactly (first, last, size), free = positions 1 to `F`, tranches contiguous, no gaps or overlap, last tranche ends at `n`.
2. Access is by the set of owned tranches: owning only tranche 2 opens 26-40 and nothing in 6-25; refunding tranche 1 while owning 2 closes exactly 6-25.
3. `premium_all` opens every tranche of every grown-up category and none of a kids or teen category.
4. `buildCatalog()` yields the 8 current ids plus the four `_2` ids; ids and entitlement ids match the pattern.
5. iPhone (TestFlight, sandbox): Tech Dystopia, answer 5, question 6 shows the paywall "Open the next 20 questions"; buy tranche 1: 6-25 play, 26 shows the paywall "Open the next 15 questions"; buy tranche 2: all 40 play; relaunch and Restore keep both. High Life: question 6 paywall "Open the next 15", one purchase opens to 20.
6. Web with the free unlock on: one tap opens the next tranche only (or all, per Tim), and the copy says "free for now".

**Done when.** The ticket's acceptance tests 1 to 10 and the tranche tests above pass on web and iPhone, and Tim has reviewed each PR.

## Later

Items from the MVP spec and growth plan that are not scheduled yet live in `docs/specs/growth-plan.md` and
`docs/specs/would-you-rather-mvp.md`.
