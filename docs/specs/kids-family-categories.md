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
  **server-side in batches into a reviewed pool**, never per child, and served from a cacheable endpoint with no ID. Cost is under
  $1 per 100 accepted questions; human review of under-13 batches is the real cost.
- Boundary for the no-tracking kids rule: **every category whose youngest age is under 13**. Teen categories (13–17)
  follow the adult rules but keep the purchase gate.
- Tracking (§5.4): under 13, count-only first-party server counters and no PostHog; 13+, anonymous first-party
  PostHog (not ATT tracking, no prompt); web→app via Apple's Smart App Banner and campaign links. Legal questions go to #114.

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

Totals: 223 existing retagged (20+41+55+20+47+3+4+33), **103** new written to reach the targets
(Tiny Choices +10, Road Trip Rally +10, Heart to Heart +27, Future Me +26, Real Talk +30). Target total: 326 written.
Free: 9 x 8 = **72** (down from 223). Paid written: **254** (326 − 72), plus AI.

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
is removed; `/categories/kids-family` redirects to "With kids" mode. Two predicates replace the literal id: **no-tracking**
(`isKidsPath()`, `FAMILY_FRIENDLY`) = `audience === 'kids'`; **parental gate** (`requiresParentalGate()`) =
`audience === 'kids' || audience === 'teen'`. `app/unlock/[id].tsx` today uses one value (`kidsDirected`) for both the
gate and turning off `track()`; Unit 4 splits it so the teen paywall keeps the gate and keeps analytics. Both derive
from `audience`, with a unit test that fails if any `kids` category is
missing from the kids-route set.

## 3. Upgrade path

### 3.1 Flow (mirrors the adult unlock)

1. Category screen: 8 playable questions, then the locked rows ("👑 N more · Unlock") already used by adult categories.
2. Question 8's result screen and `/complete/<id>` show "Want more [Category]? Ask a grown-up" → `/unlock/<id>`.
3. `/unlock/<id>`: **parental gate first** (existing `ParentalGate`), then the paywall: price, "includes new questions
   added over time and More like this", "Unlock everything $4.99", Restore Purchases. No analytics on this path for `audience: 'kids'`
   categories; the Real Talk (teen) paywall keeps the gate and keeps analytics (§2.3).
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
offering. **Superseded by §3.4:** kids and teen categories are sold as tranches, and the one $4.99 pack opens every category (§3.4 Decisions, revised). The per-category product line above no longer applies to them.
New iOS products (**superseded by §3.4.1: 10 tranche products beyond question 20, no separate With kids pack, catalog 8 → 18**; the old "9, 8 → 17" no longer applies). `buildCatalog()` picks them up automatically once
they have paid content; `npm run rc:sync` creates them in the Test Store; App Store Connect products are created by Tim
(go-live is Tim's, per `docs/payments.md`).

Pricing options (decision D2; **kids and teen categories now follow §3.4 tranches, Tim 2026-11-24**):

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

### 3.4 Tranche pricing (decided, revised 2026-11-24; replaces the per-category unlock for kids and teen categories)

#### 3.4.0 Current model: one free count, $1.99 per 20, $4.99 across all categories (Tim, 2026-11-24; supersedes 3.4.1 and the 12-tranche text below where they differ)

Tim's exact words: "Just keep it simple, each category has N number of free questions, call it 5. Then the next is to open 20 more for $1.99
(pretty generous). $4.99 opens across all categories. This seems simpler. Across the 8 or so categories, that's 40 free questions, maybe more. We need
to think about how to scale this later." The orchestrator's reading:

- **One rule for every category** (adult, kids, teen). The first N = **5** questions are free. N is the single constant `FREE_QUESTIONS_PER_CATEGORY` in
  `constants/questions.ts`; `targetFreeQuestionCount` returns it and the tranche model and catalog use it. **The live screens keep today's counts until `UNIFORM_FREE_COUNT_LIVE` is turned on in 4c** (staged like the pack limit).
- Each $1.99 **step** opens the next 20 in ONE category. Adult: one step, everything paid (at most 35). Kids and teen: exactly one step of 20 for now (see the kids cap below). Generated questions: #203, not built.
- The $4.99 pack opens **step 1 of every category**. **Decided (Tim): step 1 only.** The code does step 1 only, behind `PACK_LIMITED_TO_FIRST_STEP` (false in 4a, flipped in 4c).
- Kids and teen: one non-consumable per step, membership frozen as explicit ids (`constants/trancheAssignments.ts`). Adult: one step on the existing `cat_<id>` that opens everything paid (at most 35), as that product sells today, so no new adult products and no existing buyer loses anything.

**Decided later the same day (Tim, via the orchestrator).**
1. Pack scope: "Yes, the pack opens the first paid 20 in each cateogyr." So the pack opens step 1 (the first paid 20) of every category; the deciding question is closed (option A).
2. Kids cap: "yes, just generate for the kids and we won't allow auto generate, max it 20 per kid without the ability to keep going right now. Maybe a button to click to express interest, but just say \"you'll be notified when this feature is available\"". Orchestrator's reading: a kids or teen category stops after its first paid 20 (5 free + the $1.99 step, which the pack also opens); no second step for now; the written kids questions after position 25 are **kept, not deleted, and withheld** (closed, not for sale). No on-demand generation for kids. Adult infinite scroll (#203) stays a later phase, not built.
3. Copy: "Copy: \"More questions are on the way\", with no promise of a notification." So the end of a kids category says "More questions are on the way" and promises nothing. No identifier or contact is collected from a child; if a tap control is kept at all it is an anonymous aggregate counter (no user id, device id or email), built in 4c. A parent-gated email capture (option B, "You'll be notified...") is parked until legal #114.

**Catalog: 17 products** = the pack + 7 adult categories (Midnight Secrets and Deep Desires stay out of iOS v1) + **9 kids and teen steps** (one per category, always 20 questions, `wyr_unlock_<category>_1`). No kids category has a second step.

| Category | Written | Free | Step 1 ($1.99, also in the pack) | Withheld |
|---|---|---|---|---|
| Tiny Choices | 30 | 5 | 20 | 5 |
| Make-Believe | 41 | 5 | 20 | 16 |
| Giggle Factory | 55 | 5 | 20 | 30 |
| Road Trip Rally | 30 | 5 | 20 | 5 |
| Dinner Table | 47 | 5 | 20 | 22 |
| Heart to Heart | 30 | 5 | 20 | 5 |
| Future Me | 30 | 5 | 20 | 5 |
| Real Talk (teen) | 30 | 5 | 20 | 5 |
| Holiday Table | 33 | 5 | 20 | 8 |
| **Total** | **326** | **45** | **180** | **101** |

Adult: 5 premium-tier categories (20 written: 5 free + 15 paid, one `cat_<id>`; 3 are on iOS v1) and 4 free-tier categories (40 written: 5 free + 35 paid, one `cat_<id>`).

**What changes versus today for adult (the user-visible part; happens in 4c, not 4a):**

| Adult group | Today | New rule |
|---|---|---|
| Premium-tier: High Life, Midnight Secrets, Time Traveler, Deep Desires, Wildest Dreams | 3 free, 17 behind `cat_<id>` | **5 free** (+2), 15 behind `cat_<id>`; the pack covers all 15 once limited. Nothing lost. |
| Free-tier: Moral Compass, Social Blunders, Career Climber, Tech Dystopia | **20 free** + 20 expansion for $1.99 | **5 free** (**-15**), 35 behind `cat_<id>` $1.99 (the same product). Users lose 15 free questions per category, 60 in all. With the pack limited, the pack opens 20 of the 35 and `cat_<id>` opens the last 15. |
| Existing `cat_<id>` and pack buyers | everything | everything (unchanged while the pack is staged; after 4c the pack opens step 1 only, **a change for existing pack holders**, RevenueCat read-only showed 0 production holders on 2026-11-24). |

SEO (4c): the adult category pages list only free questions in JSON-LD, so each free-tier adult page goes from 20 to 5 listed questions. Flagged for Tim.

**Restore, non-consumable vs consumable.** A non-consumable is restorable by Apple on any device with no account of ours, which is why the kids routes can sell it with no persisted ID. A consumable ("next 20") is simpler to catalogue (one product for all categories) but Apple does not restore it, so we would need our own ledger tied to a user, which the kids no-tracking rule forbids, and App Review can reject a consumable that unlocks permanent content. Keep non-consumables. **Cheaper to maintain alternative:** one non-consumable per kids or teen *category* that opens everything written (9 products, 17 in all), at the cost of no "next 20" pricing for 4 categories with more than one step and no room to price generated questions per step; generated questions (#203) could then be a separate consumable. Not recommended: it breaks Tim's "next 20 for $1.99".

**The deciding question (answered by Tim: step 1 only): does the $4.99 pack open only step 1 of every category, or everything written?** Prices: $1.99 per step, $4.99 pack. The break-even is 3 categories (3 × $1.99 = $5.97 > $4.99).
- 16 categories are sellable on iOS v1 (7 adult + 9 kids and teen). Step 1 of all of them at $1.99 is **$31.84**; the pack is $4.99, so the pack is a 84% discount for the first step.
- **A, pack = step 1 only (chosen by Tim):** with the kids cap, a player who wants everything sold pays $4.99 + the last 15 of the 4 adult free-tier categories ($7.96) = **$12.95 at most**; kids have nothing further to buy. (Before the kids cap the figure was $20.91.)
- **B, pack = everything written:** the same player pays **$4.99**, once. Every later step and every generated question (#203) is free for pack holders, so #203 would have to be funded by the $4.99 or sold separately again. Revenue at the margin is $7.96 lower per completist and the pack becomes an unbounded promise.
Tim chose A. It matches Tim's earlier "only the first 20 per category come with the pack", keeps #203 sellable, and still gives a 3-category buyer a reason to take the pack.

#### 3.4.1 Earlier model (superseded by 3.4.0 where it differs; was: supersedes the 12-tranche version below where they differ)

Tim's exact words (answering the questions on #203): "1. Only the first 20 per category come with the pack unlock 2. 1.99 buys the next 20 in a
category 3. 1.99 buys 20 more in one category, repeatable 4. ACcept this". Earlier the same day: "We should just have one pack for everything",
"$4.99 just unlocks everything. However, ... if I reach the end of the original 20 (that should be the max for every category) ... that's $1.99 and is
not included in the $4.99." The orchestrator's reading, checked against the data below: the one $4.99 pack (`wyr_premium_all`) opens the **first 20
questions of every category** (for kids and teen: the 8 free plus the next 12); everything written beyond 20 is **not** in the pack; each $1.99 opens the
next batch in **one** category, repeatable: first the written questions beyond 20, in list order, then generated ones once the written run out (#203,
not built). Credits do not follow a user across devices (no accounts yet; Tim accepted).

**What the data says (kids and teen), by position in each category's list:**

| Category | Written | Free | The pack opens | Beyond 20 | $1.99 tranches (sizes) |
|---|---|---|---|---|---|
| Tiny Choices | 30 | 8 | 12 | 10 | 1 (10) |
| Make-Believe | 41 | 8 | 12 | 21 | 1 (21) |
| Giggle Factory | 55 | 8 | 12 | 35 | 2 (20, 15) |
| Road Trip Rally | 30 | 8 | 12 | 10 | 1 (10) |
| Dinner Table | 47 | 8 | 12 | 27 | 1 (27) |
| Heart to Heart | 30 | 8 | 12 | 10 | 1 (10) |
| Future Me | 30 | 8 | 12 | 10 | 1 (10) |
| Real Talk | 30 | 8 | 12 | 10 | 1 (10) |
| Holiday Table | 33 | 8 | 12 | 13 | 1 (13) |
| **Total** | **326** | 72 | 108 | **146** | **10 tranches ($19.90 to buy all)** |

Sizes use the same rule as before (20 per tranche, a remainder under 10 joins the previous one), applied once to the questions beyond 20 and then frozen as
explicit ids (`constants/trancheAssignments.ts`).

**Adult categories (what the data says).** Five premium-tier categories (High Life, Midnight Secrets, Time Traveler, Deep Desires, Wildest Dreams) have exactly 20
questions (3 free), so the pack opens all of them, as today. Four free-tier categories (Moral Compass, Social Blunders, Career Climber, Tech Dystopia) have
**40**: 20 free plus a volume-2 expansion of 20. Under "only the first 20 per category come with the pack" the pack would **stop** opening that expansion (it opens it
today), and the per-category $1.99 (which sells exactly "the next 20") remains the only way in. That is the same rule applied to adult, but it is a change to what
the pack opens in 4 adult categories; **flagged for Tim to confirm** (there are no buyers, see the RevenueCat check below, so no one loses access).

**Not literally "20".** Written questions beyond 20 are only 10 to 35 per category, so 6 of the 9 kids and teen categories sell **fewer than 20** in their first purchase
(10 or 13) and Giggle Factory sells 20 then 15. The paywall copy therefore says the real number ("Open the next {n} questions"). To make "the next 20" literally true,
the partial tranches are topped up with generated questions (#203) or more are written: **an open question for Tim.**

**Product shape, consumable or not, stated plainly.**
- (Superseded by §3.4.0: one step per kids category, 17 products.) *One non-consumable per tranche* (recommended for the written questions): 10 kids and teen products (`wyr_unlock_<category>_<k>`), plus the 7 adult category products and the pack = **18 products**.
  Apple **restores** non-consumables, so a reinstall or a new phone gets them back. The cost: it is a fixed list, so every new batch (including generated ones) would need a new product,
  which cannot be unbounded.
- *One repeatable consumable per category* ("20 more", $1.99): one product per category, repeatable without new products. Apple **does not restore consumables**, so a reinstall or new device
  loses what was bought unless we keep a count ourselves, and kids routes keep no ID. App Review can also reject a consumable that unlocks permanent content. Tim accepted that credits do not follow a user
  across devices, but that is a reason to use it only where there is no fixed set.
- Recommendation: non-consumable tranches for the **written** questions (permanent content, restorable), and a repeatable consumable per category for the **generated** "keep going" only (#203, not built, not in this catalog).

**Staging.** The live paywall still sells "Or unlock every category" as everything, so in 4a the pack is **not** limited yet (`PACK_LIMITED_TO_FIRST_STEP = false` in `lib/tranches.ts`) and keeps opening
what it opens today; the tests pin both that and the target. 4c changes the paywall and flips the flag (and updates the pack's name and description to "first 20 questions of every category").

---
**The rest of this section is the earlier version** (12 tranches that started right after the free 8, before Tim's answers on #203). Where it conflicts with 3.4.1 above, 3.4.1 wins:


**Decision (Tim, 2026-11-24, exact words):** "I would like a tranch of 20 new questions opened every $1.99." The model: 8 free per
category, then each $1.99 purchase opens the **next 20** questions of that category, repeatable until the category is
exhausted. This supersedes §3.3's "$1.99 unlocks the whole category" and D2's 9 per-category products for kids and teen
categories. **Status: decided (Tim accepted all five defaults on 2026-11-24, see Decisions below). Nothing here is built yet; it is Unit 4.**

**Tranche membership is frozen (`constants/trancheAssignments.ts`).** A purchased tranche is a non-consumable and must open the same questions forever,
so its members are written down as explicit question ids, generated once from today's data with the rule below. The rule is never re-applied to the
live question count (adding 5 questions to Holiday Table must not turn its 25-question tranche into 20 and charge again for the other 5). New paid
questions are closed until assigned: add them to a new tranche at the end, or append them to the last one (owners only gain). A test fails when a
paid kids or teen question is unassigned.

**What a tranche is.** Let *F* be the category's free count, **always read from `getFreeQuestionCount(category)`, never hardcoded**. It is 8 for
every kids and teen category, but 3 for premium-tier adult categories and 20 for free-tier adult ones. Tranche *k* of a kids or teen category is the
paid questions at positions `F + 20(k-1)` to `F + 20k - 1` in its list (free *F* first, then paid, in the order the data lists them).
**Adult categories are not split:** an adult category has exactly one tranche (all its paid questions after *F*), and it is granted by the
**existing `cat_<id>` entitlement** (`entitlementForCategory`), not by a `cat_<id>_1` id, so no existing adult buyer loses access. Only kids and teen
categories use the `cat_<category>_<k>` ids. Rule for the end of a list: a remainder under 10 joins the previous
tranche, otherwise it is a tranche of its own. With today's 254 paid questions:

| Category | Paid | Tranches (sizes) |
|---|---|---|
| Tiny Choices | 22 | 1 (22) |
| Make-Believe | 33 | 2 (20, 13) |
| Giggle Factory | 47 | 2 (20, 27) |
| Road Trip Rally | 22 | 1 (22) |
| Dinner Table | 39 | 2 (20, 19) |
| Heart to Heart | 22 | 1 (22) |
| Future Me | 22 | 1 (22) |
| Real Talk | 22 | 1 (22) |
| Holiday Table | 25 | 1 (25) |
| **Total** | **254** | **12 purchases, $23.88 if a family buys everything** |

Only 3 of the 12 tranches are exactly 20 questions (the first tranche of Make-Believe, Giggle Factory and Dinner Table). The other 9
are not: 22 (five of them), 13, 27, 19 and 25. Alternative, to make every tranche exactly 20 paid: trim 2 from each 22-question
category (one clean 20), or write 18 more for each (40 paid, two clean 20s); Make-Believe, Giggle Factory, Dinner Table and Holiday
Table need their own trim or top-up (13 to 20 needs 7 more, 27 to 40 needs 13 more, 39 to 40 needs 1 more, 25 to 20 trims 5). That is
content work for Tim to approve, not something a purchase flow can hide.

**Product shape (recommended): one non-consumable per tranche.** Product `wyr_unlock_<category>_<k>` ($1.99), entitlement
`cat_<category>_<k>`, 12 products in the `default` offering. Why not a repeatable consumable (`wyr_<category>_next20`, 9 products):
- Apple does not restore consumables. A parent who reinstalls or buys a new phone loses what they paid for unless we keep a
  purchase count on our side, and kids routes keep no ID. Content that stays unlocked is a non-consumable by Apple's own
  definition, and App Review can reject a consumable that unlocks permanent content.
- Family Sharing and Restore Purchases work only for non-consumables.
- Cost of the recommendation: every new tranche (new writing, later AI batches) needs a new product created in App Store
  Connect and RevenueCat. Fine for the 12 now; AI "More like this" (Unit 5 and 6) must not be sold this way and needs its own answer.

**Access rule.** The boolean `isQuestionLocked(category, index, unlocked)` is replaced by a new `isQuestionOpen(category, index, access)` (4a adds it
alongside, 4b moves every caller and deletes the boolean helpers, see `docs/specs/plan.md`). A question is open if its index is below the category's
`getFreeQuestionCount` (not a hardcoded 8: adult free counts are 3 or 20), or its tranche's entitlement is active (kids and teen: `cat_<category>_<k>`; adult: the existing `cat_<id>`), or `premium_all` applies (the one pack opens every category, adult, kids and teen; see Decisions). The paywall offers
only the **lowest tranche not owned**. Access is decided per tranche from the **set of owned tranche numbers**, never from a prefix or a
count: a refund of tranche 1 while tranche 2 is still owned must close exactly tranche 1 and keep tranche 2 open. This changes `lib/catalog.ts`, `constants/questions.ts` access helpers,
`contexts/UnlockedContext.tsx` and `app/unlock/[id].tsx`: all payments surface, all Unit 4.

**Every purchase sits behind the parental gate** (existing `ParentalGate`), for kids and teen categories alike. The paywall copy
changes from "Unlock N more" to "Open the next {n} questions · $1.99", where `{n}` is the **actual size of that tranche** (20, 22, 13, 27, 19 or 25;
9 of the 12 are not 20), and shows how many remain. Copy must never promise a number the purchase does not deliver.

**Web.** Until #53 decides web payments, a kids or teen paywall on web shows "Unlock in the iPhone app" behind the gate and never
grants anything (§3.1, unchanged). That includes the temporary production web free unlock (`WEB_FREE_UNLOCK`): it opens adult categories only, and a
stored free unlock or `premium_all` on web never opens a kids or teen tranche (pinned by a 4c test, in the same PR that removes the free button from the kids paywall, so the button is never left doing nothing). Owner access, for the owner and testers, still opens everything.

**The existing 8 products** (`wyr_premium_all` and 7 adult `wyr_unlock_*`): untouched. `wyr_premium_all` keeps its id, entitlement, $4.99 price and name
("All Categories") and now simply opens **every** category, adult, kids and teen (Tim: "one pack for everything", "$4.99 just unlocks everything"). It is
today's behavior in the app's access rule, so nothing changes for anyone. Checked read-only in RevenueCat on 2026-11-24 (project wyr, counts only):
4 customers in total; 0 production (real) purchases of any product; 0 customers hold `wyr_premium_all` in any environment, and 0 have a `premium_all`
entitlement; the only purchases are 5 sandbox purchases of 3 adult category products (High Life, Moral Compass, Wildest Dreams). (Side note: sandbox
purchases of three adult App Store products exist, so those products exist in at least a sandbox form although `store/ios/iap.md` says none were
created; that file is stale, to be checked in 4d.) Nothing was ever sold for the old Kids & Family category, and the 9 kids category products planned
earlier were never created, so there is nothing to retire.
Adult paid sets are 17 to 20 questions per category, which is one tranche, so the adult model **already is** the tranche model with
one tranche per category. Recommended: leave adult categories as they are.
`buildCatalog()` now derives 9 kids and teen category products (8 → 17). It would instead derive the 10 tranche products beyond question 20 (8 → 18, see 3.4.1).
The two tests that fail on purpose today (`catalog.test.ts` product count, `asc-iap-create.test.ts` product-file parity) move to 18,
and `store/ios/iap-products.json` plus the App Review screenshots gain the 10 tranche products (10 new) in that same Unit 4 change.

**Decisions (Tim, 2026-11-24).** Tim's exact words: "accept all five tranche defaults". The defaults are the recommendations as they
were put to him, relayed by the orchestrator session. They settle the five open questions:
1. **The $4.99 all-categories pack** (`wyr_premium_all`) stays. *(Revised by Tim, later 2026-11-24, replacing the default of an adult-only pack plus a
   separate With kids pack: "We should just have one pack for everything." and "$4.99 just unlocks everything".)* There is **one** pack, it opens every category,
   adult, kids and teen, and there is no With kids pack and no `wyr_premium_kids` product. Tim also described an "infinite scroll" $1.99 option, not
   included in the $4.99, that generates new questions on demand; it is its own issue with open questions (#203) and is **not built**.
   Tim's exact words: "Originally when you proposed the family pack $9.99 I agreed, but $4.99 just unlocks everything. However, we have an "inffinite
   scroll" option meaning if I reach the end of the original 20 (that should be the max for every category) and someone wants to keep going, that's $1.99
   and is not included in the $4.99." **Answered later the same day (#203, see 3.4.1):** the pack opens the first 20 questions of every category; "$1.99 buys the next 20 in a category", repeatable. The 12-tranche table below is the earlier version; the current model is 10 tranches beyond question 20 (3.4.1).
2. **Adult categories** stay as they are. Their 17 to 20 paid questions are already one tranche.
3. **End of list:** a remainder under 10 questions merges into the previous tranche. No new questions are written now.
4. **One non-consumable product per tranche** (12 products, restorable), not a repeatable consumable.
5. **Order:** the 20 questions in each tranche come in current id order. Tim may curate later.

**Staging (4a to 4c).** The live paywall still sells the per-category unlock `cat_<id>` on kids and teen categories, so until 4c changes it to sell
tranches, `cat_<id>` keeps opening the whole category (and `premium_all` opens everything). 4c decides whether any such legacy holder is grandfathered;
the RevenueCat check found none.

**Consequences for the build (Unit 4, see `docs/specs/plan.md`).** `premium_all` is not narrowed and nothing is renamed: it already opens kids and teen
categories, and now that is the intended behavior. There is no With kids pack, so no `premium_kids` entitlement and no extra product. Product count after
Unit 4 is 18 (8 today plus the 10 tranches beyond question 20, see 3.4.1).

## 4. AI "more like this"

### 4.1 Shape: pre-generated, reviewed pool per category

Tim wants "AI spins off and generates them". The parent sees exactly that: after unlock, More like this keeps serving new
questions. Under the hood, generation runs **server-side, in batches, into a per-category pool**, not once per child:

- A scheduled job (Vercel cron, `api/cron/kids-pool.js`) runs monthly and generates one batch of 50 candidates per
  category, using only data the server has: it skips a category that has any `draft` row (a batch is still waiting
  for review, so drafts never pile up in Tim's queue), whose newest row of any status was created under 25 days ago
  (the last generation; below the cron interval so no monthly run is skipped by calendar drift), or whose approved
  pool has reached the cap (300 per category, then
  stop and revisit). The server never learns what any family has seen, so "unserved" is not a usable trigger.
- Every candidate runs the safety pipeline (§4.3). Failures are logged as `rejected` at once; only passing candidates
  are stored as `draft`. Under-13 drafts need human approval; teen candidates that pass go straight to `approved`
  (decision D5), so a teen category never holds `draft` rows that would block the next run.
- Approved questions are served by a cacheable function, `GET /api/pool/<category>` (`api/pool/[category].js`), which
  reads `status = 'approved'` rows from `kids_pool` and responds with `Cache-Control: public, max-age=3600, s-maxage=3600,
  stale-while-revalidate=86400` (CDN and browser fresh for an hour), no cookies,
  no query string. Static files don't work here: `vercel.json` builds a static site fixed at deploy time, so a cron
  can't add files, and the catch-all rewrite `/((?!api/).*)` → `/index.html` would answer a missing `/kids-pool/*.json`
  with the SPA HTML and status 200. Paths under `/api/` skip that rewrite; an unknown category returns a JSON 404, and
  `lib/pool.ts` treats any non-JSON or non-200 reply as offline.
- The app fetches that endpoint on More like this. Locks are enforced on the device. No entitlement check reaches our server, so no RevenueCat ID is sent from a kids
  screen. **Trade-off, stated plainly:** this is weaker than today, where locked text sits only inside the app bundle;
  the pool endpoint is a public, guessable URL anyone can fetch. We accept that (the content is cheap to make and the
  buyer pays for the curated, age-matched flow, not secrecy). To keep paid questions out of search next to the free
  SEO pages: the endpoint sends `X-Robots-Tag: noindex`, and robots.txt gets `Disallow: /api/pool/`.
  The web simulated grant (§1.3.3) must be fixed before the pool exists.

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
  reading-level check for under-13 bands: each option is scored separately against the category's **oldest** age,
  limit FK grade ≤ max(1, oldest age − 4), and the 3–5 and 4–8 bands use a word-count rule instead (≤ 8 words per option,
  no word over 3 syllables), because FK is unreliable on 5-word sentences. Unit 5 must run the rule on the hand-picked
  free 8 of every category first; if any fail, the rule is wrong, not the questions.

### 4.3 Kids-safety filtering

1. **Blocklist** (deterministic, before and after the model): violence, weapons, death, romance/dating/kissing (under
   13), body shape and weight, brands, real people, religion, politics, medical, scary themes, money pressure, personal
   info prompts ("what's your address"). Kept in `lib/kidsBlocklist.ts`, unit-tested.
2. **Classifier pass** (Sonnet 5.5): pass/fail per question with reasons: safe for the age, on topic, not
   embarrassing or singling out (e.g. "would you rather have no friends"), both options acceptable to say aloud,
   no duplicate of an existing question. Any fail is logged with status `rejected` (never `draft`) and is not edited.
   Unit 5's fake-model tests cover a teen batch with failures and check the next monthly run is not blocked.
3. **Human-reviewable log**: every candidate, verdict and reason in a `kids_pool` table (Neon, already used for votes):
   `id, category, optionA, optionB, ages, model, prompt_version, classifier_verdict, reasons, status
   (draft|approved|rejected|retired), report_count, reported_at, reviewed_by, created_at`. An owner-only review page (`/owner/kids-pool`, behind
   the existing owner access) lists drafts with approve/reject in bulk. A "report this question" link on paid questions
   (behind the parental gate, `POST /api/report`, body `{questionId}` only, no ID) increments `report_count` and sets `reported_at`; the question stays
   `approved` and keeps being served. Only an owner action on the review page (which lists reported questions first)
   changes `status`. An anonymous report cannot be told apart from a script, so a report never hides content by itself;
   the worst a scripted loop can do is fill the review list. The endpoint is rate-limited by IP at the edge (no stored ID).

### 4.4 Cost per 100 questions

Assumptions per batch of 50 candidates: ~6,000 input tokens (system, examples, dedupe list), ~2,000 output plus
~4,000 thinking at low effort; classifier ~4,000 in / ~3,000 out; 60% of candidates survive.

| Step | Per 100 candidates | Per 100 accepted |
|---|---|---|
| Generation, Opus 5.5 | ~$0.29 | ~$0.48 |
| Classifier, Sonnet 5.5 | ~$0.08 | ~$0.13 |
| **Total** | | **~$0.61** (~$0.31 with the Batch API, which suits a cron job) |
| All-Haiku 5.5 alternative | | ~$0.02 |

Seeding 100 extra per category (9 categories) costs about $6; a year of refills at 50 accepted per category per month
(5,400 accepted) is about $33, and about $165 at 5x these estimates, within the $20/month ($240/year) spend cap. **Money is not the constraint; Tim's review time is** (about 10 minutes per 50 under-13 drafts).

### 4.5 Rate limits, caching, offline

- Generation is bounded by the cron, not by users: max 1 batch per category per month (§4.1), monthly spend cap enforced in the
  job (stop at $20/month, alert via the daily report). No per-user rate limit is needed because users never trigger a
  model call.
- Caching: generate once, serve forever to every family; prompt caching on the system block across the 9 categories.
- Offline / no network: the app ships the written paid questions in the bundle, so an unlocked category still plays.
  More like this shows "New questions need a connection" and falls back to replaying the category. On web and native the
  app keeps the last pool response in memory for the session only (no storage on kids routes); the browser's HTTP cache
  helps for at most the one-hour `max-age`. After that, offline means the "New questions need a connection" fallback.
- "Seen" tracking: the kids rule forbids storing kids progress. Recommended (decision D6): allow one device-local,
  never-sent number per category ("next pool index"), which is not an identifier. Without it, More like this starts at a
  random point each visit and will repeat.

### 4.6 Key and kids rule

- Key: the Anthropic key from #93, stored as `ANTHROPIC_API_KEY` in **Vercel server env only** (used by the cron job),
  never `EXPO_PUBLIC_*`, never in the app. Requested through the credential form, never in chat. Note #93 planned a
  build-time-only key; this extends it to a server-side cron. No user-facing route calls the model.
- Kids rule compliance: the model receives no child data, no IDs, no votes, no device info. Kids routes make three new
  requests, none with a query string, cookie or ID: the pool endpoint, the report endpoint (only when a parent taps
  report) and the usage counter (§5.4). Votes on pool questions (`kf-ai-*`) follow the
  existing `kf-` rule (no visitor ID, nothing stored on device). The votes API must accept pool ids (read the same pool).
  `tests/browserless/kids-no-tracking.mjs` gets exactly three URL patterns added to its allowlist and nothing else,
  none with a query string, cookie or identifier: `GET /api/pool/<category>` (Unit 6), `POST /api/report` with a body
  of `{questionId}` only (Unit 6, §4.3), and `POST /api/count` with a body of `{event, category, platform}` (Unit 7, §5.4).

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
- Add: "With kids mode loads new questions from our server, and a parent can report a question; neither request
  sends an ID, only the category or the question."
- If D6 is approved: "The app remembers on your device how far you have got in each category. It is not sent anywhere."
- Teen categories: covered by the existing general section (analytics on), stated explicitly.

### 5.3 App Privacy labels (`docs/specs/app-store-listing.md` §5.3)

No new data type is collected: the AI pipeline uses no user data, the pool fetch carries no identifier, purchases are
already declared. Labels unchanged. Update the listing text ("Kids & Family is free" → "family categories with free
questions and an optional unlock") and the review notes (paths for the gate: any category in With kids mode → Unlock).
Keep "kids" out of the app name/subtitle/keywords (guideline 2.3.8, per the listing spec).

### 5.4 Tracking by age band

Tim, 2026-11-19 (verbatim): "What are the actual guidelines for tracking? Like, for me, usage is the most important
tracking, and probably getting to the web page to come to the apps. ... the more anonymous tracking we can get to
improve the product, the better. But I don't want to reduce age or reduce the ability to gain approval from Apple"

**Source status.** Apple's pages were read in this session (2026-11-20), but only partly: guideline 1.3 and 2.3.8 are
quoted verbatim; 5.1.1, 5.1.2(i) and 5.1.4 came from a summary of the rest of the page, so treat them as **unverified**.
The ATT tracking definition and App Privacy categories were read verbatim. **ftc.gov and ecfr.gov are blocked by this
environment's network policy**, so every COPPA point below is from prior knowledge and **unverified**; check each
against 16 CFR Part 312 and the FTC's 2025 final rule before relying on it.

What the rules say:

| Source | What it says | Status |
|---|---|---|
| COPPA, 16 CFR 312.2, "personal information" | Includes a persistent identifier that can recognise a user over time and across sites or services (examples given: cookie IDs, IP address, device serial numbers). | unverified |
| COPPA 312.2, "support for the internal operations" | Includes maintaining or analysing how the service functions, personalising content, contextual ads, security, authentication, legal compliance. Excludes contacting a specific person, behavioural advertising, and building a profile of a specific person. | unverified |
| COPPA 312.5(c)(7) | A persistent identifier may be collected without parental consent if it is used **only** for internal operations. The 2025 amendments add an online notice requirement: name the specific internal operations and how the identifier is kept from other uses. | unverified (amendments recalled as published April 2025, compliance from April 2026) |
| COPPA 2025, "mixed audience" | A service directed to children that does not target them as its primary audience may screen ages neutrally and treat users under 13 as children. Whether "With kids" mode inside a 13+ general app is "mixed audience" or a child-directed section is a **legal judgement**. | unverified |
| Apple 1.3 (Kids Category) | "In limited cases, third-party analytics may be permitted provided that the services do not collect or transmit the IDFA or any identifiable information about children (such as name, date of birth, email address), their location, or their devices." Links out and purchases only "behind a parental gate". | verified (verbatim) |
| Apple 5.1.4 (Kids) | "Apps intended primarily for kids should not include third-party analytics or third-party advertising." | unverified (summary) |
| Apple 2.3.8 | "Use of terms like 'For Kids' and 'For Children' in app metadata is reserved in the App Store for the Kids Category." | verified |
| Apple ATT, "tracking" | "linking user or device data collected from your app with user or device data collected from other companies' apps, websites, or offline properties for targeted advertising or advertising measurement purposes", or sharing with data brokers. Linking that happens only on the device and is not sent off it is not tracking. First-party analytics that is never linked with other companies' data is outside this definition (our reading; Apple does not say it in so many words). | verified definition; reading is ours |
| Apple App Privacy | Usage Data → **Product Interaction** ("app launches, taps, clicks, scrolling information…"); purpose **Analytics** ("evaluate user behavior… understand the effectiveness of existing product features, plan new features"). Data counts as linked to the user "unless specific privacy protections are put in place before collection to de-identify or anonymize it", and you "must not attempt to link the data back to the user's identity". | verified |

Recommended default, validated against the above:

| Band | What we measure | How | Not allowed |
|---|---|---|---|
| **Under 13** (every `audience: 'kids'` category: With kids mode except Real Talk) | Count-only usage: category opened, question answered (already a vote), "more like this" served, unlock screen shown. Per day x category x platform. | **First-party server-side counters** on our own endpoint (`api/count.js`, request with no ID, no cookie, IP never stored). Votes already give per-question counts. **No PostHog on these routes**, not even in memory-only mode: 5.1.4 discourages any third-party analytics in kids sections, and our own counters need no third party. | Persistent IDs, PostHog person profiles or any PostHog event, IDFA/IDFV, region, ads of any kind, ATT prompt. |
| **13+** (Real Talk, all Grown-ups mode) | Product analytics: funnels, retention, paywall conversion. | PostHog as now (adult screens only, `lib/analyticsCore.ts`), IP discarded in the PostHog project, no ad networks, never linked with other companies' data. Identifier: **in memory on iOS** (no storage package installed); **persisted on web** in `localStorage` (`wyr_visitor_id`, `lib/analytics.ts` `getOrCreateVisitorId`) on every non-kids route, Real Talk included. Not "tracking" under ATT, so **no ATT prompt**. App Privacy: Usage Data → Product Interaction, purpose Analytics, **Not Linked to You** for the iOS label (holds while the iOS ID is not persisted and there is no account; re-check if either changes). The web's persisted ID is covered by the privacy policy, not the App Store label. | Ad SDKs, data brokers, cross-app linking, demographic inference. |
| **Bridge (Grown-ups → With kids)** | How many parents use With kids mode and come back. | One PostHog event, `with_kids_opened`, fired on the **Grown-ups** screen when the parent taps the switch (an adult route, before any kids screen). Nothing is sent after it. This gives a parent-level retention signal without measuring the child. | Any event from inside With kids mode; joining kids counters to the PostHog ID. |
| **Web → app** | Which landing pages send installs. | Apple's **Smart App Banner** (`<meta name="apple-itunes-app" content="app-id=6836653723">`) and **App Store Connect campaign links** (`apps.apple.com/app/apple-store/id6836653723?pt=<provider>&ct=<page-slug>`), read in App Analytics. Apple-provided, no SDK, nothing sent to us. | Fingerprinting or deferred deep-link SDKs (AppsFlyer, Branch) on kids pages. |

The Smart App Banner tag and the `pt`/`ct` campaign parameters are **unverified** here (Apple's page returned no body).
Confirm both in Apple's docs and App Store Connect before building.

What this costs Tim: no per-child retention or session length for under-13 bands. Retention comes from the bridge event
(parents) and from 13+ analytics. That is the trade for keeping the kids rule and App Review clean.

**For legal review before submission (added to #114):**
1. Is "With kids" mode a child-directed section of a general-audience app or "mixed audience" under COPPA 2025, and
   does either need an age screen?
2. Do first-party server counters that see an IP for the request but never store it fall within "support for internal
   operations", and which 312.5(c)(7) online notice wording does the privacy policy need?
3. Is the `with_kids_opened` bridge event (fired on an adult screen) acceptable, or does it count as information about
   a child's use?
4. Is "Not Linked to You" correct for PostHog with an in-memory anonymous ID on iOS, and is the web's persisted
   anonymous visitor ID (13+ routes only) adequately disclosed?
5. Is a Smart App Banner for a 13+ app acceptable on kids-directed landing pages that address parents?

### 5.5 PRD changes (proposed; Tim applies or rejects)

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
| 1 | Content: categories, retag, hand-pick free 8, write 103 new questions | `constants/kidsQuestions.ts` (split per category file if large), `api/_lib/data.js`, `scripts/verify-questions.ts` (new checks: every kids question in exactly one category, free count 8, ages set, blocklist clean) | **Yes**: read every new question (103) | `npm run verify:data`, `npm test` |
| 2 | Model + kids-rule plumbing: `audience`, `ages`, remove `kids-family`, redirect, derive `isKidsPath`/`requiresParentalGate`/`FAMILY_FRIENDLY` from `audience` | `constants/questions.ts`, `lib/kidsPaths.ts`, `lib/parentalGate.ts`, `constants/seoPages.ts` (D4), `tests/unit/*` | No (privacy rule, but no payments) | unit tests incl. "every kids category is a kids route"; `tests/browserless/kids-no-tracking.mjs` on every new route |
| 3 | Browse UI: Grown-ups / With kids switch, age chips, age label on cards, mode-scoped random | `app/index.tsx`, `app/categories/index.tsx`, `components/CategoryCard.tsx` | No | screenshots at phone width; navigation test |
| 4 | Payments (replanned 2026-11-24, see §3.4 and `docs/specs/plan.md`: five PRs 4a to 4e): 9 step products (§3.4.0), catalog sync, paywall copy, gate on every kids and teen purchase and link out; web kids paywall shows "unlock in the app" (no simulated grant) | `lib/catalog.ts`, `lib/tranches.ts`, `app/unlock/[id].tsx`, `scripts/revenuecat/sync-catalog.ts`, `docs/payments.md` | **Yes (payments)** | `npm test` (catalog has 18 products), `npm run rc:sync` twice (idempotent), DEVICE rows 7–15 of the payments test plan per new category |
| 5 | AI pipeline (server): blocklist, generator, classifier, `kids_pool` table, cron, `GET /api/pool/<category>` endpoint, owner review page | `lib/kidsBlocklist.ts`, `api/cron/kids-pool.js`, `api/pool/[category].js`, `api/_lib/pool.js`, `db/migrations/*`, `app/owner/kids-pool.tsx`, `vercel.json` | **Yes** (key, spend cap, first batch review) | unit tests with a fake model client; dry run on one category; Tim approves the first 50 |
| 6 | More like this (client) + votes accept pool ids + report link | `app/complete/[id].tsx`, `app/categories/[id].tsx`, `lib/pool.ts`, `api/_lib/votes.js`, `api/report.js`, `tests/browserless/kids-no-tracking.mjs` | **Yes** (touches the paid surface) | kids-no-tracking test passes with only the pool and report URLs added (Unit 7 adds the counter URL); offline check, including an HTML reply treated as offline |
| 7 | Privacy policy (incl. the COPPA internal-operations notice, §5.4), listing kit, review notes, PRD, kids counters `api/count.js`, Smart App Banner + campaign links on landing pages | `app/privacy.tsx`, `api/count.js`, `tests/browserless/kids-no-tracking.mjs` (counter URL), `components/PageHead.tsx`, `docs/specs/app-store-listing.md`, `docs/kids-privacy.md` | **Yes** (policy text) | `tests/unit/legal-pages.test.ts` |

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
