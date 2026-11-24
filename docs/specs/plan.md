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
| 4 | Payments: tranche products, one $4.99 pack for everything, paywall, parental gate on every kids and teen purchase. Tim accepted all five tranche defaults on 2026-11-24, then asked for one pack for everything. **Plan below; in progress as separate PRs** | Tim reviews every PR, none auto-merged |
| 4s | **SEO question pages: every question indexed, read-only, feeding the web app** (#206). Tim, 2026-11-24: "One URL per question plus category pages listing them", "Yes, all withheld paid questions are public", "Search traffic should lange on the page with the web app link", "Yes, reuse the share pages", "Pillar articles shoudl live on the same would you rather.fyi site" (full quote and design in `docs/specs/seo-question-pages.md`, S1 PR). PRs S1 to S8, none touch payments; S2 and S3 block 4c's free-count flip. The research step waits on the orchestrator's go | Tim reviews |
| 4+ | **Infinite scroll: generate more questions on demand, $1.99, not in the $4.99 pack** (#203). Tim answered the first round on 2026-11-24, then simplified: N = 5 free per category, $1.99 = the next 20 in one category, repeatable, the $4.99 pack opens step 1 of every category; the model is in 4a. Generation, storage and moderation are not built and wait on his remaining answers | Tim reviews |
| 5 | AI pool (server): safety filter, generator, review queue, cached endpoint | Tim reviews, approves the first batch |
| 6 | More like this in the app, reports | Tim reviews |
| 7 | Privacy policy, kids counters, listing and review notes, Smart App Banner | Tim reviews the policy text |

Units 1 to 3 are on `main`. Questions 9 onward in each kids and teen category are locked, but no product exists to
unlock them yet (the catalog derives 9 category products that were never created; the two tests that pin the old 8
products fail on purpose, see the PRD on #124). Unit 4 must land before kids unlocks can be sold. Units 5 and 6 wait
until Unit 4 shows parents buy the written unlock.

### Unit 4 build plan

**Decided (Tim, 2026-11-24, "accept all five tranche defaults"; spec §3.4):**
1. The $4.99 all-categories pack stays, and **there is one pack for everything** (Tim, later the same day: "We should just have one pack for everything", "$4.99 just unlocks everything"): it opens every category, adult, kids and teen. No With kids pack. (This replaces the default of an adult-only pack plus a With kids pack.) Tim also asked for an "infinite scroll" $1.99 option, not in the $4.99, that generates questions on demand: its own issue, #203, not built.
2. Adult categories stay as they are (their 17 to 20 paid questions are already one tranche).
3. A remainder under 10 questions merges into the previous tranche. No new questions are written now. *(Applied once, to the questions beyond the first 20.)*
4. One non-consumable product per tranche (restorable). *(Revised by Tim's answers on #203: the tranches are the written questions beyond the first 20, 10 products for kids and teen.)*
5. The 20 questions in each tranche come in current id order. Tim may curate later.

**Flagged assumptions (not Tim's words, confirm before the store has them):**
- Tranche ids: product `wyr_unlock_<category>_<k>`, entitlement `cat_<category>_<k>`, `k` from 1. Same shape as today.
- Teen (Real Talk) is sold like the kids categories (tranches, behind the gate).
- Decided by Tim: the pack opens step 1 only (spec §3.4.0). 4a does not limit the pack yet (`PACK_LIMITED_TO_FIRST_STEP = false`).

**The model (Tim, 2026-11-24, simplified; spec §3.4.0):** one rule for every category (adult, kids, teen): the first **N = 5** questions are free (`FREE_QUESTIONS_PER_CATEGORY` in `constants/questions.ts`, the only place the number is set); each **$1.99 opens the next 20** in one category; the **$4.99 pack opens step 1 of every category** (Tim: "Yes, the pack opens the first paid 20 in each cateogyr."). **Kids cap (Tim: "max it 20 per kid without the ability to keep going right now"):** a kids or teen category has exactly one step of 20; the 101 written questions after it are withheld (kept, closed, not sold); no on-demand generation for kids; the end of a kids category says "More questions are on the way" (Tim's chosen copy, no notification promise, nothing collected from a child; any tap control is an anonymous aggregate counter, built in 4c; option B parent-gated email waits on legal #114). Adult is one step per category on the existing `cat_<id>` (everything paid, at most 35); adult infinite scroll (#203) is a later phase, not built. Product count after Unit 4: **17** (the pack, 7 adult categories, 9 kids and teen steps). Written steps are non-consumable (restorable). **Adult impact:** the four free-tier adult categories go from 20 free to 5 free (-15 each), the five premium-tier ones from 3 to 5 free.

**No store sync before 4c/4d.** The legacy kids and teen per-category products (`wyr_unlock_<kids id>`) are not in the catalog any more and must not be created: they were never created in RevenueCat (checked read-only on 2026-11-24: the `default` offering has 8 packages, the pack and 7 adult categories, and none for kids), so the live kids "ONE-TIME CATEGORY UNLOCK" button already has no package to buy on `main` today and 4a does not change that; 4c replaces that button with the tranche paywall. `npm run rc:sync` is not run until the orchestrator says so.

**Rule.** Every payments change is its own PR. They are never batched, none is auto-merged, and each goes to Tim's queue with a link and
one line on what a user would notice. No App Store Connect product, and no RevenueCat product, is created without asking the orchestrator
first. The CI that creates products (`apple-iap-create`, `apple-iap-review-screenshot`) is never run by the build.

| PR | One change | What a user would notice | Tests |
|---|---|---|---|
| 4a | Pure model. `lib/tranches.ts` (the access model: `Access = { all, pack, ownedTranches }`, `questionZone`, `isQuestionOpen(category, index, access)`, `nextTrancheToSell`, `trancheSizes`), tranche ids in `lib/catalog.ts`, and `constants/trancheAssignments.ts`, the **frozen** question ids of each kids and teen category's steps (after the 5 free questions, one step of 20 per category, 9 in all; step 1 is also what the pack opens) and the `withheld` ids (101), so an owned `cat_<category>_<k>` opens the same questions forever, a paid question in no list is closed until assigned, and a test fails if one is unassigned. The pack opens step 1 of every category in the model, **but is not limited yet in 4a** (`PACK_LIMITED_TO_FIRST_STEP = false`): the live paywall still sells it as "every category", so it keeps opening what it opens today until 4c flips the flag; both settings are pinned by tests. The legacy per-category `cat_<id>`, which the live kids paywall still sells, keeps opening a whole kids or teen category until 4c. `premium_all` and its name are unchanged. A read-only RevenueCat check on 2026-11-24 found 4 customers, 0 production purchases and 0 holders of `wyr_premium_all`. An adult category is one tranche on the existing `cat_<id>` (never `cat_<id>_1`); the free count is `FREE_QUESTIONS_PER_CATEGORY` (5) through `getFreeQuestionCount`, never a literal. **4a does NOT change the live free count** (Sinatra P1): `getFreeQuestionCount` keeps today's 3 or 20 adult and 8 kids and teen behind `UNIFORM_FREE_COUNT_LIVE = false`; the tranche model and the catalog use the target `targetFreeQuestionCount` (5). **4c flips `UNIFORM_FREE_COUNT_LIVE` together with the pack limit**, which is when users notice: the four free-tier adult categories lock 15 questions each (60 in all), kids go 8 to 5, **SEO must not shrink** (Tim, 2026-11-24: "Let's no compromise SEO", #206): the public pages, listed questions and sitemap are decoupled from the in-app free count before 4c flips it, pinned by `tests/unit/seo-counts.test.ts` (floors from `main`: sitemap 202 URLs, per-page question counts), so the flip cannot land until that is done. **4a adds the tranche-aware helpers alongside the existing boolean `isQuestionLocked` and `getAccessibleQuestions`, which stay unchanged**, so every current caller still compiles and 4a passes typecheck and CI on its own. No screen changes behavior for anyone: the live free count, the sitemap and the SEO pages are unchanged. | Nothing. | New `tranches.test.ts`; `catalog.test.ts` moves to 17 products; an adult-regression test pins that every adult category still unlocks exactly as before. |
| 4b | Context and screens read per-tranche access. `UnlockedContext` exposes `accessFor(id)` (the `access` value above, built from entitlements) (owner access, which is for the owner and testers, still opens everything. **4b leaves the temporary web free unlock (`WEB_FREE_UNLOCK`, Tim's "128 b") behaving exactly as today**; it is narrowed in 4c, in the same PR as the paywall change, so a kids paywall button never does nothing between two deploys); every caller moves to the tranche-aware helpers: `app/index.tsx`, `app/categories/[id].tsx`, `app/complete/[id].tsx`, `app/feed/index.tsx`, `app/game/[id].tsx`, `app/kids/index.tsx`, `app/results/[id].tsx`, `app/settings.tsx`, `lib/nextCategory.ts`, and the two SEO scripts `scripts/generate-sitemap.ts`, `scripts/verify-seo.ts` and `constants/seoPages.ts` (`getSeoPageQuestions`, lines 590 and 599). The scripts and `seoPages.ts` are the guards that keep locked question text out of the sitemap, JSON-LD and the adult SEO landing pages: each passes an explicit no-purchase `access` (`{ all: false, ownedTranches: new Set() }`), never `all: true` and never a local boolean shortcut, and a test pins that for every one of them. The list above is a starting point, not the contract: the contract is that **no reference to the old boolean `isQuestionLocked` / `getAccessibleQuestions` remains anywhere** (a test greps the code directories `app/`, `lib/`, `constants/`, `contexts/`, `components/`, `hooks/`, `scripts/` and `tests/`, the test files included: `tests/unit/kids-categories.test.ts` lines 52 and 147 move too; docs under `docs/` are excluded from the grep and 4b updates the ones that name the old helpers, `docs/seo.md` and spec §3.4 and its old text, by hand), and typecheck is green. Then the old helpers and the deprecated `isPremiumGated` wrapper in `constants/questions.ts` are deleted (nothing outside `questions.ts` uses `isPremiumGated`). | Nothing for adults. An owned kids tranche opens that tranche's questions (its real size). | Updated call-site tests; kids no-tracking browser test unchanged. |
| 4c | Paywall. `app/unlock/[id].tsx` offers only the **next** tranche ("Open the next {n} questions · $1.99" with `{n}` the tranche's real size: 10, 21, 20, 15, 27 or 13, and how many remain), the parental gate on every kids or teen purchase (the one "unlock every category" pack stays on kids and teen paywalls, behind the gate), "Unlock in the iPhone app" on web, **in the same PR the pack becomes limited to step 1 of every category (`PACK_LIMITED_TO_FIRST_STEP = true`), is renamed accordingly ("the next 20 questions of every category"), and the legacy `cat_<id>` stops opening a whole kids or teen category (4c decides about grandfathering)**, and **in the same PR the web free unlock becomes adult-only**: `accessFor(id)` returns `all: true` from a free unlock only for adult categories, the free CTA and `unlock(id)` / `unlockAll()` calls are removed from kids and teen paywalls (`app/unlock/[id].tsx` `WEB_FREE_UI` path), so a stored `premium_all` or per-category free unlock never opens a kids or teen tranche (spec §3.4 and §3.1). A test pins it, including a stored `premium_all` on a kids category. | A kids paywall that sells the next tranche of questions (its real size, shown on the button). | Paywall copy and gate tests; browser run of the kids paywall with no tracking. |
| 4d | Store files. `store/ios/iap-products.json` and `store/ios/iap.md` gain the 9 step products; `scripts/revenuecat/sync-catalog.ts` and `scripts/render-iap-review-screenshots.mjs` handle tranche ids; the `CREATE-8-IAPS` confirmation becomes `CREATE-17-IAPS`. Review screenshots are rendered from 4c's paywall and committed. **Nothing is run against App Store Connect or RevenueCat.** | Nothing. | `asc-iap-create.test.ts` parity and `asc-iap-review-screenshot.test.ts` go green. |
| 4e | Create the products. Only after the orchestrator says go and Tim has settled #203 (which may change the tranche products): dry run of the create workflow, then the apply. | Kids tranches become buyable on iOS. | Dry-run output attached. |

The two tests that fail on purpose today (`catalog.test.ts` product count, `asc-iap-create.test.ts` parity) are fixed by 4a and 4d. The
review-screenshot test is expected red between 4a and 4d for the new products only, because the screenshots need 4c's paywall.

**Open risks.**
- 4b touches the access rule everywhere. Adult behavior must not change; 4a's regression test and a full `npm test` guard that.
- A tranche bought out of order (restore, refund, a promo) must not hide a question the player owns or open one they do not: access uses the set of owned tranches, never a count or prefix. Example pinned by a 4a test: a refunded step with no pack closes exactly that step's 20 and leaves the 5 free ones, and the paywall offers tranche 1 (the lowest not owned).
- Refund of a tranche closes only that tranche. The listener already revokes on the next fetch.
- Family Sharing is off for all products today (`familySharable: false`); that stays unless Tim asks.

## Later

Items from the MVP spec and growth plan that are not scheduled yet live in `docs/specs/growth-plan.md` and
`docs/specs/would-you-rather-mvp.md`.
