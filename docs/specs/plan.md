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
| 4+ | **Infinite scroll: generate more questions on demand, $1.99, not in the $4.99 pack** (#203). Tim answered the first round on 2026-11-24 (pack = first 20 per category; $1.99 = the next batch in one category, repeatable); the model is in 4a. Generation, storage and moderation are not built and wait on his remaining answers | Tim reviews |
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
- Whether the pack should stop opening the 20-question expansion of the four free-tier adult categories (Tim's "first 20 per category" applied to adult). The model supports either; 4a does not limit the pack yet.

**The model (Tim, 2026-11-24, answers on #203; spec §3.4.1):** the one $4.99 pack opens the **first 20 questions of every category**; each $1.99 opens the next batch in
**one** category, repeatable (first the written questions beyond 20, then generated ones, #203). For kids and teen categories the written questions beyond 20 are 146, in **10 tranches**:
Tiny Choices 10; Make-Believe 21; Giggle Factory 20 and 15; Road Trip Rally 10; Dinner Table 27; Heart to Heart 10; Future Me 10; Real Talk 10; Holiday Table 13. Adult categories are unchanged
(one `cat_<id>` per category; four free-tier adult categories have 20 questions beyond the first 20, which the pack would no longer open: flagged for Tim). Product count after Unit 4:
**18** (the pack, 7 adult categories, 10 tranches). Written tranches are non-consumable (restorable); a repeatable consumable per category is for the *generated* part only (#203, not built).

**Rule.** Every payments change is its own PR. They are never batched, none is auto-merged, and each goes to Tim's queue with a link and
one line on what a user would notice. No App Store Connect product, and no RevenueCat product, is created without asking the orchestrator
first. The CI that creates products (`apple-iap-create`, `apple-iap-review-screenshot`) is never run by the build.

| PR | One change | What a user would notice | Tests |
|---|---|---|---|
| 4a | Pure model. `lib/tranches.ts` (the access model: `Access = { all, pack, ownedTranches }`, `questionZone`, `isQuestionOpen(category, index, access)`, `nextTrancheToSell`, `trancheSizes`), tranche ids in `lib/catalog.ts`, and `constants/trancheAssignments.ts`, the **frozen** question ids of each kids and teen category's pack zone (positions 9 to 20) and tranches (beyond 20, 10 in all), so an owned `cat_<category>_<k>` opens the same questions forever, a paid question in no list is closed until assigned, and a test fails if one is unassigned. The pack opens the first 20 questions of every category in the model, **but is not limited yet in 4a** (`PACK_LIMITED_TO_FIRST_20 = false`): the live paywall still sells it as "every category", so it keeps opening what it opens today until 4c flips the flag; both settings are pinned by tests. The legacy per-category `cat_<id>`, which the live kids paywall still sells, keeps opening a whole kids or teen category until 4c. `premium_all` and its name are unchanged. A read-only RevenueCat check on 2026-11-24 found 4 customers, 0 production purchases and 0 holders of `wyr_premium_all`. An adult category is one tranche on the existing `cat_<id>` (never `cat_<id>_1`); the free count is always `getFreeQuestionCount` (3, 8 or 20), never a hardcoded 8. **4a adds the tranche-aware helpers alongside the existing boolean `isQuestionLocked` and `getAccessibleQuestions`, which stay unchanged**, so every current caller still compiles and 4a passes typecheck and CI on its own. No screen changes behavior for anyone. | Nothing. | New `tranches.test.ts`; `catalog.test.ts` moves to 18 products; an adult-regression test pins that every adult category still unlocks exactly as before. |
| 4b | Context and screens read per-tranche access. `UnlockedContext` exposes `accessFor(id)` (the `access` value above, built from entitlements) (owner access, which is for the owner and testers, still opens everything. **4b leaves the temporary web free unlock (`WEB_FREE_UNLOCK`, Tim's "128 b") behaving exactly as today**; it is narrowed in 4c, in the same PR as the paywall change, so a kids paywall button never does nothing between two deploys); every caller moves to the tranche-aware helpers: `app/index.tsx`, `app/categories/[id].tsx`, `app/complete/[id].tsx`, `app/feed/index.tsx`, `app/game/[id].tsx`, `app/kids/index.tsx`, `app/results/[id].tsx`, `app/settings.tsx`, `lib/nextCategory.ts`, and the two SEO scripts `scripts/generate-sitemap.ts`, `scripts/verify-seo.ts` and `constants/seoPages.ts` (`getSeoPageQuestions`, lines 590 and 599). The scripts and `seoPages.ts` are the guards that keep locked question text out of the sitemap, JSON-LD and the adult SEO landing pages: each passes an explicit no-purchase `access` (`{ all: false, ownedTranches: new Set() }`), never `all: true` and never a local boolean shortcut, and a test pins that for every one of them. The list above is a starting point, not the contract: the contract is that **no reference to the old boolean `isQuestionLocked` / `getAccessibleQuestions` remains anywhere** (a test greps the code directories `app/`, `lib/`, `constants/`, `contexts/`, `components/`, `hooks/`, `scripts/` and `tests/`, the test files included: `tests/unit/kids-categories.test.ts` lines 52 and 147 move too; docs under `docs/` are excluded from the grep and 4b updates the ones that name the old helpers, `docs/seo.md` and spec §3.4 and its old text, by hand), and typecheck is green. Then the old helpers and the deprecated `isPremiumGated` wrapper in `constants/questions.ts` are deleted (nothing outside `questions.ts` uses `isPremiumGated`). | Nothing for adults. An owned kids tranche opens that tranche's questions (its real size). | Updated call-site tests; kids no-tracking browser test unchanged. |
| 4c | Paywall. `app/unlock/[id].tsx` offers only the **next** tranche ("Open the next {n} questions · $1.99" with `{n}` the tranche's real size: 10, 21, 20, 15, 27 or 13, and how many remain), the parental gate on every kids or teen purchase (the one "unlock every category" pack stays on kids and teen paywalls, behind the gate), "Unlock in the iPhone app" on web, **in the same PR the pack becomes limited to the first 20 questions of every category (`PACK_LIMITED_TO_FIRST_20 = true`), is renamed accordingly ("first 20 questions of every category"), and the legacy `cat_<id>` stops opening a whole kids or teen category (4c decides about grandfathering)**, and **in the same PR the web free unlock becomes adult-only**: `accessFor(id)` returns `all: true` from a free unlock only for adult categories, the free CTA and `unlock(id)` / `unlockAll()` calls are removed from kids and teen paywalls (`app/unlock/[id].tsx` `WEB_FREE_UI` path), so a stored `premium_all` or per-category free unlock never opens a kids or teen tranche (spec §3.4 and §3.1). A test pins it, including a stored `premium_all` on a kids category. | A kids paywall that sells the next tranche of questions (its real size, shown on the button). | Paywall copy and gate tests; browser run of the kids paywall with no tracking. |
| 4d | Store files. `store/ios/iap-products.json` and `store/ios/iap.md` gain the 10 tranche products; `scripts/revenuecat/sync-catalog.ts` and `scripts/render-iap-review-screenshots.mjs` handle tranche ids; the `CREATE-8-IAPS` confirmation becomes `CREATE-18-IAPS`. Review screenshots are rendered from 4c's paywall and committed. **Nothing is run against App Store Connect or RevenueCat.** | Nothing. | `asc-iap-create.test.ts` parity and `asc-iap-review-screenshot.test.ts` go green. |
| 4e | Create the products. Only after the orchestrator says go and Tim has settled #203 (which may change the tranche products): dry run of the create workflow, then the apply. | Kids tranches become buyable on iOS. | Dry-run output attached. |

The two tests that fail on purpose today (`catalog.test.ts` product count, `asc-iap-create.test.ts` parity) are fixed by 4a and 4d. The
review-screenshot test is expected red between 4a and 4d for the new products only, because the screenshots need 4c's paywall.

**Open risks.**
- 4b touches the access rule everywhere. Adult behavior must not change; 4a's regression test and a full `npm test` guard that.
- A tranche bought out of order (restore, refund, a promo) must not hide a question the player owns or open one they do not: access uses the set of owned tranches, never a count or prefix. Example pinned by a 4a test: Giggle Factory with tranche 1 refunded and tranche 2 owned opens exactly tranche 2's 27 questions, and the paywall offers tranche 1 (the lowest not owned).
- Refund of a tranche closes only that tranche. The listener already revokes on the next fetch.
- Family Sharing is off for all products today (`familySharable: false`); that stays unless Tim asks.

## Later

Items from the MVP spec and growth plan that are not scheduled yet live in `docs/specs/growth-plan.md` and
`docs/specs/would-you-rather-mvp.md`.
