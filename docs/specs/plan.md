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

**Rule (Tim, 2026-11-25, final).** After the free-count corrections, Tim: "$199 is an upgrade for one category only. so it goes from 5 free questions to a total of 20. so that frees 15. then the next upgrade in the same category would give them another 20". Read "$199" as $1.99. Earlier the same day he said every category has "5 free questions and an upgrade" and that there is no "entirely free" category. History: "each unlocked scope within a single category is just an additional 20 questions capped" (superseded by the final wording). He wrote "i believe we said it was 5"; the orchestrator treats **free count `F = 5` as set**. Nothing in the repo said 5 (code: 3 and 8). Kids and teen: Tim has not changed the rule (`F = 8`, 12 tranches, spec §3.4).

**The rule.** Every grown-up category: positions 1 to 5 free. Upgrade 1 ($1.99) opens positions 6 to 20 (15 questions). Upgrade 2 ($1.99) exists only where a category has more than 20 questions and opens positions 21 to 40 (20 questions). Cut points fall at 5, 20 and 40 (then 60, 80 and so on if more is written). Tranche 2 is exactly the old volume 2 (`td-21..td-40`), so `volume` and access line up. No category is free: the four former-free categories (Moral Compass, Social Blunders, Career Climber, Tech Dystopia) drop from 20 free to 5.

**Decisions (Tim and the orchestrator, 2026-11-25).**
- Kids and teen: "Use 5, keep it consistent." Same free count and the same tranche function as grown-ups (`F = 5`, tranche 1 ends at 20, later tranches add 20). The kids special case goes away, in its own later PR (`K` below). This supersedes the 8 free of 2026-11-24 for kids and teen.
- Web: "One tap opens one upgrade. ... it should mimic exactly the same product categorizations of $1.99 unlocks a single category up to 20 questions (so 15 are unlocked in addition to the original free 5)." While no web payment exists, one tap grants the next tranche free; the button shows the $1.99 price with "Free for now". Done in F2 (PR #242). **Superseded by Tim, 2026-11-25 (#250): web reuses the same payments path as the app; no "Free for now" end date and no "Get the app" redirect.** The plan is on #250 (steps W0-W5, one PR each, nothing built).
- Search pages: "Yes". Questions 6 to 20 of Moral Compass, Social Blunders, Career Climber and Tech Dystopia stay public. The public set is pinned per category id (`PUBLIC_QUESTION_COUNTS`), so retagging or a new free count cannot change it. Done in F2 (PR #242); F3 shrinks to nothing.
- Home: shows 260 grown-up questions, matching its 9 categories (orchestrator). Done in F2.

**Free questions (counted from the data on main).** Grown-up: 9 categories x 5 = **45** of 260 questions (35 on iOS v1, which hides Midnight Secrets and Deep Desires). Kids and teen: 9 x 5 = 45 of 326 after the kids step (today 9 x 8 = 72). Tim's "8 or more categories, 40 questions" is 8 x 5; the real figure is 45 on web, 35 on iOS.

**Tranche function.** `tranches(category)`, 1-based positions, `F = getFreeQuestionCount(category) = 5`, `n` questions in category order: tranche 1 = `F+1` to `min(20, n)`; tranche `k >= 2` = `20(k-1)+1` to `min(20k, n)`; no tranche when its start is above `n`; a remainder under 10 joins the previous tranche (none occurs today). Access is decided by the **set of owned tranche numbers**, never a prefix or a count: owning only tranche 2 opens 21-40 and nothing else; a refund of tranche 1 closes exactly 6-20. Kids and teen keep their own boundaries (`F + 20(k-1) + 1` to `F + 20k`, `F = 8`); the function takes the boundary rule per audience, so one function and one access-by-set rule serve both.

| Category | n | Free | Tranche 1 (positions, size: product, entitlement) | Tranche 2 |
|---|---|---|---|---|
| The High Life | 20 | 1-5 (hl-1..hl-5) | 6-20 (15): `wyr_unlock_high_life`, `cat_high-life` | none |
| Midnight Secrets (not on iOS v1) | 20 | 1-5 (ms-1..ms-5) | 6-20 (15): `wyr_unlock_midnight_secrets`, `cat_midnight-secrets` | none |
| Time Traveler | 20 | 1-5 (tt-1..tt-5) | 6-20 (15): `wyr_unlock_time_traveler`, `cat_time-traveler` | none |
| Deep Desires (not on iOS v1) | 20 | 1-5 (dd-1..dd-5) | 6-20 (15): `wyr_unlock_deep_desires`, `cat_deep-desires` | none |
| Wildest Dreams | 20 | 1-5 (wd-1..wd-5) | 6-20 (15): `wyr_unlock_wildest_dreams`, `cat_wildest-dreams` | none |
| Moral Compass | 40 | 1-5 (mc-1..mc-5) | 6-20 (15): `wyr_unlock_moral_compass`, `cat_moral-compass` | 21-40 (20): `wyr_unlock_moral_compass_2`, `cat_moral-compass_2` |
| Social Blunders | 40 | 1-5 (sb-1..sb-5) | 6-20 (15): `wyr_unlock_social_blunders`, `cat_social-blunders` | 21-40 (20): `wyr_unlock_social_blunders_2`, `cat_social-blunders_2` |
| Career Climber | 40 | 1-5 (cc-1..cc-5) | 6-20 (15): `wyr_unlock_career_climber`, `cat_career-climber` | 21-40 (20): `wyr_unlock_career_climber_2`, `cat_career-climber_2` |
| Tech Dystopia | 40 | 1-5 (td-1..td-5) | 6-20 (15): `wyr_unlock_tech_dystopia`, `cat_tech-dystopia` | 21-40 (20): `wyr_unlock_tech_dystopia_2`, `cat_tech-dystopia_2` |

Free ranges use the ids in category order (for example `td-1..td-5`). Tranche 1 keeps today's ids and entitlements, so nothing that exists changes id; tranche 2 adds four, per the kids pattern `wyr_unlock_<category>_<k>` / `cat_<id>_<k>`.

**Products.** 8 today (`wyr_premium_all` + 7 category products on iOS v1) become 12: four new, non-consumable, $1.99, en-US: `wyr_unlock_moral_compass_2`, `wyr_unlock_social_blunders_2`, `wyr_unlock_career_climber_2`, `wyr_unlock_tech_dystopia_2`. Product text (App Store Connect limits: display name 30 characters, description 45; longest here is 25 and 37):
- Tranche 1 (the 7 existing ids): display name "<Category>: 15 more", description "15 more questions in <Category>". Example: "Tech Dystopia: 15 more", "15 more questions in Tech Dystopia".
- Tranche 2 (the four new ids): display name "<Category>: 20 more", description "20 more questions in <Category>". Example: "Moral Compass: 20 more", "20 more questions in Moral Compass".
Today's text is "<Category>" and "Every question in <Category>", which is wrong under the rule. Reference names stay "Unlock <Category>" and become "Unlock <Category> 2". Each new product needs a review screenshot (`store/ios/iap-review/<productId>.png`, rendered from the paywall).

**`wyr_premium_all`** ($4.99) opens every tranche of every grown-up category, including tranches added later (this is already decided in §3.4). It never opens kids or teen tranches.

**Kids and teen (step K, a separate later PR).** One function for everyone: `tranches(category)` with `F = 5`; a tail of 10 or fewer joins the previous tranche (Tim, 2026-11-25: "kids upgrade: yes"), so the five 30-question categories are one tranche of 25. Product ids follow the grown-up pattern: tranche 1 `wyr_unlock_<category>` (the id the catalog already derives for the 9 kids and teen categories; none exists in the store), tranche k >= 2 `wyr_unlock_<category>_<k>` with entitlement `cat_<id>_<k>`. This replaces §3.4's `_1` suffix and its 12 tranches at `F = 8`. Kids and teen tranches are **not** opened by `wyr_premium_all`; the With kids pack stays a separate decision (§3.4), and all kids purchases keep the parental gate. **14 tranche products** instead of 12 or 19 (9 first tranches, 5 later ones), $1.99 each. PR #251 implements the rule; the table below is the pre-fold draft of 19 and the 30-question rows now read one tranche, 6-30 (25):

| Category | n | Free | Tranches (positions, size: product, entitlement) |
|---|---|---|---|
| Tiny Choices | 30 | 1-5 | 6-20 (15): `wyr_unlock_tiny_choices`, `cat_tiny-choices`, 21-30 (10): `wyr_unlock_tiny_choices_2`, `cat_tiny-choices_2` |
| Make-Believe | 41 | 1-5 | 6-20 (15): `wyr_unlock_make_believe`, `cat_make-believe`, 21-41 (21): `wyr_unlock_make_believe_2`, `cat_make-believe_2` |
| Giggle Factory | 55 | 1-5 | 6-20 (15): `wyr_unlock_giggle_factory`, `cat_giggle-factory`, 21-40 (20): `wyr_unlock_giggle_factory_2`, `cat_giggle-factory_2`, 41-55 (15): `wyr_unlock_giggle_factory_3`, `cat_giggle-factory_3` |
| Road Trip Rally | 30 | 1-5 | 6-20 (15): `wyr_unlock_road_trip_rally`, `cat_road-trip-rally`, 21-30 (10): `wyr_unlock_road_trip_rally_2`, `cat_road-trip-rally_2` |
| Dinner Table | 47 | 1-5 | 6-20 (15): `wyr_unlock_dinner_table`, `cat_dinner-table`, 21-47 (27): `wyr_unlock_dinner_table_2`, `cat_dinner-table_2` |
| Heart to Heart | 30 | 1-5 | 6-20 (15): `wyr_unlock_heart_to_heart`, `cat_heart-to-heart`, 21-30 (10): `wyr_unlock_heart_to_heart_2`, `cat_heart-to-heart_2` |
| Future Me | 30 | 1-5 | 6-20 (15): `wyr_unlock_future_me`, `cat_future-me`, 21-30 (10): `wyr_unlock_future_me_2`, `cat_future-me_2` |
| Real Talk (teen) | 30 | 1-5 | 6-20 (15): `wyr_unlock_real_talk`, `cat_real-talk`, 21-30 (10): `wyr_unlock_real_talk_2`, `cat_real-talk_2` |
| Holiday Table | 33 | 1-5 | 6-20 (15): `wyr_unlock_holiday_table`, `cat_holiday-table`, 21-33 (13): `wyr_unlock_holiday_table_2`, `cat_holiday-table_2` |

Open for K: the kids "free 8" are hand-picked in order, so the first 5 stay free and questions 6 to 8 become paid (Tim reads this as intended: "keep it consistent"); the With kids pack price ($9.99 was the orchestrator's assumption); the 10-question tranches question is settled by the fold above.

**Creating the four products without a write by the Apple ops key.** The Apple ops workflow is read-only and stays so. Tim creates them: (1) by hand in App Store Connect: app > Monetization > In-App Purchases > "+" > Non-Consumable, product id, $1.99, en-US text, review screenshot; or (2) the existing `Apple IAP create` workflow (`apple-iap-create.yml`: dry run first, then `apply=true` with its confirm string, hard-coded `CREATE-8-IAPS`, which a small separate PR changes first; it skips ids that exist, so the 8 existing products keep their old text and Tim edits that in App Store Connect). Both use the same `ASC_*` secrets; only workflow (2) writes. RevenueCat products, entitlements (`cat_<id>_2`) and packages come from `npm run rc:sync` (Tim runs it; I never do) or the dashboard.

**Buyers.** None known: RevenueCat revenue is $0 over 28 days, the iOS app is unreleased (version 1.0 is `PREPARE_FOR_SUBMISSION`), web unlocks for free. The 8 products are `READY_TO_SUBMIT` (never approved), so their text can change.

**Web payment path today (read from the repo and RevenueCat read-only, 2026-11-25).** The code is built: `lib/purchases.ts` + `lib/purchases-web-core.ts` use RevenueCat Web Billing (Stripe) through `@revenuecat/purchases-js`, with `EXPO_PUBLIC_RC_WEB_KEY` per Vercel environment (`rcb_sb_` sandbox on Preview, `rcb_` live on Production; the build refuses a wrong key). It is not live: the RevenueCat project has only a Test Store app and an App Store app (no Web Billing app, so no Stripe connection), and Production runs the temporary free unlock (`EXPO_PUBLIC_WEB_FREE_UNLOCK=1`). `docs/payments.md` names one go-live blocker: the web buyer's id is an anonymous RevenueCat id in `localStorage`, which Safari deletes after 7 days without a visit, so a returning iPhone buyer can lose access (ticket #135). Options to charge on web (prices are from memory and unverified; check current terms):
1. RevenueCat Web Billing + Stripe (built): create the Web Billing app, connect Stripe, add the 12 products, set the live key, fix the durable id (sign-in or a magic-link email), turn the free unlock off. Effort: days, mostly the durable id and a test pass. Cost: Stripe about 2.9% + $0.30 per charge (about $0.36, 18%, on $1.99), plus RevenueCat's fee above its free revenue tier.
2. Stripe Checkout and our own entitlement service (webhook, accounts): no RevenueCat fee, but we own accounts, refunds and tax. Effort: one to two weeks. Cost: Stripe fees only.
3. A merchant of record (Paddle, Lemon Squeezy): they handle sales tax and VAT. Effort: about a week plus the same durable id. Cost: about 5% + $0.50 (about 30% on $1.99), unverified.
4. Keep web free and send paying users to the app: no work, no web revenue; contradicts "mimic exactly the same product categorizations".
Not built here; each option needs the durable id first. **Decided direction (Tim, 2026-11-25, #250): option 1, the same path as the app.** Plan, blind spots (Stripe fees about 18% on $1.99, per-device ownership, no kids checkout) and steps W0-W5 are on #250.

| Step | What | Files |
|---|---|---|
| F1 | Rule and tests, no payments: `FREE_QUESTION_COUNT = 5`, `tier` split removed for grown-ups, `tranches()` and access by owned set, `tests/unit/tranches.test.ts` | `constants/questions.ts`, `lib/access.ts`, tests |
| F2 | Labels and paywall: no FREE pill, paywall "Open the next {n} questions", derived counts, random play uses every category | `app/index.tsx`, `app/categories/*`, `app/unlock/[id].tsx`, `app/game/[id].tsx`, `app/results/[id].tsx`, `app/complete/[id].tsx`, `components/CategoryCard.tsx`, `constants/copy.ts`, `lib/nextCategory.ts` |
| F3 | SEO: decided, questions 6-20 stay public; the pinned set is part of F2 (PR #242), nothing left | `constants/questions.ts` (`PUBLIC_QUESTION_COUNTS`) |
| F4 | Store text and docs | `store/ios/*`, `docs/specs/app-store-listing.md`, `docs/specs/kids-family-categories.md` |
| F5 | Payments, one PR: the four `_2` products and entitlements in the catalog, new product text for the 8, `iap-products.json`, confirm string | `lib/catalog.ts`, `store/ios/iap-products.json`, `store/ios/iap.md`, `.github/workflows/apple-iap-create.yml`; App Store Connect and RevenueCat creation are Tim's |
| K | Kids and teen join the one tranche function (`F = 5`), 14 products (PR #251), `premium_all` excludes kids, parental gate unchanged (payments, one PR; after F5) | `constants/questions.ts`, `lib/catalog.ts`, `lib/access.ts`, `scripts/verify-questions.ts`, `docs/specs/kids-family-categories.md` |
| F6 | Review screenshots for the four new products (and any changed paywall) | `store/ios/iap-review/` |

Each step is its own PR; F1 and F5 are payments scope and are never batched with another step.

**Acceptance tests.** Unit, `npx tsx --test tests/unit/tranches.test.ts` (written with F1):
1. Every grown-up category has `getFreeQuestionCount === 5` and `getAccessibleQuestions(c, false).length === 5`; no category has `tier === 'free'`.
2. Tranches reproduce the table exactly (first, last, size): 15 for all nine categories in tranche 1; 20 for tranche 2 of mc, sb, cc, td; none for the other five. Free + tranches cover positions 1 to `n` with no gap or overlap. Tranche 2 of each 40-question category is exactly its `volume: 2` questions.
3. Access by owned set: owning only tranche 2 opens 21-40 and nothing in 6-20; refunding tranche 1 while owning tranche 2 closes exactly 6-20; owner access and `premium_all` open everything grown-up.
4. `premium_all` opens every grown-up tranche. (Moved to step K: "and no kids or teen tranche". Today `openTranchesFor` still lets `premium_all` open kids and teen categories, as before this change; PR #240 does not touch that.)
5. `buildCatalog()` yields the 8 current ids plus `wyr_unlock_{moral_compass,social_blunders,career_climber,tech_dystopia}_2`; entitlements `cat_<id>` and `cat_<id>_2`; product text within 30 and 45 characters.
Device (TestFlight, sandbox, Tech Dystopia): answer 5; question 6 shows the paywall ("15 more", $1.99); buy; questions 6-20 play; question 21 shows the paywall ("20 more", $1.99); buy; 21-40 play; relaunch and Restore keep both. High Life: question 6 paywall, one purchase plays to 20, no second paywall. Unlock All ($4.99) opens every grown-up category. Kids categories behave as before. Web with the free unlock on: copy says "free for now"; Tim states whether one tap opens one tranche or both.

**Done when.** The ticket's acceptance tests and the tests above pass on web and iPhone, and Tim has reviewed each PR.

## Later

Items from the MVP spec and growth plan that are not scheduled yet live in `docs/specs/growth-plan.md` and
`docs/specs/would-you-rather-mvp.md`.
