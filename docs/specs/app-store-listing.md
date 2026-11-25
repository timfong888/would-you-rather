# App Store and TestFlight marketing content: plan and first drafts

Status: **plan and drafts only.** Nothing is uploaded, no App Store Connect (ASC) setting is changed, no app code is touched.
Date: 2026-11-20. Owner of the decisions: Tim. Builds on the #87 kit (`store/ios/`), which stays the source for IAP and the current screenshot set; this spec replaces its copy, age-rating and category sections where they differ and says where.

App: ASC app id `6836653723`, record name "Would You Rather? Family Fun", bundle `com.timfong888.wouldyourather`, SKU `wyr-ios-001`. iPhone only (`supportsTablet: false`, Tim 2026-11-18). iOS v1 ships 8 categories: 7 adult/teen plus free Kids & Family; Midnight Secrets and Deep Desires are left out (`constants/iosV1.ts`).

> **2026-11-25 update:** section 8 below is the field-by-field checklist for version 1.0 (ticket #243). Where it differs from sections 2 and 3 (screenshot size, "Free to start" wording, keywords), section 8 wins.

## 0. What I found that changes the plan

1. **The "see how everyone voted" story cannot be shown honestly yet.** The app shows a vote split only after 20 votes on a question (`VOTE_THRESHOLD`, PRD: never fake or seeded counts). The #87 screenshot `05-answered.png` shows the real state: no split, only "New question. Send it to someone and see if they pick the same." Captions and the description must sell the share/match loop now and the vote split only once real counts exist. Apple also wants screenshots to show the app as it is (guideline 2.3.3).
2. **Kids rules in the code were web-path based.** `isKidsPath()` read `window.location.pathname`; `analyticsOn()` returned `true` on every non-web platform, so native "no analytics on kids content" was not enforced. **Fixed by Tim's decision of 2026-11-19 (PostHog stays on, adult screens only):** native analytics is now gated by the router path in `lib/analyticsCore.ts`, closed until the route is known, with tests (`tests/unit/analytics-core.test.ts`). The native build still needs `EXPO_PUBLIC_POSTHOG_KEY` in the EAS env; without it nothing is sent.
3. **Privacy policy is still wrong on `main`** (`app/privacy.tsx`: "does not use any analytics ... or third-party SDKs", "one answer per question for each device" which PR #105 makes untrue for Kids & Family). The Privacy Policy URL is a hard submission blocker until #85 (and #105's kids change) are reflected.
4. **There is no support contact anywhere in the repo.** `app/terms.tsx` says "the app's official support channel". Apple requires a working Support URL and, for TestFlight, a feedback email. Tim must pick an address.
5. **`CLAUDE.md` is not on `main`** (it is in open PR #60), so the working agreements were not read from the repo.
6. **Metadata rule that conflicts with the SEO strategy:** the SEO pages target "for kids" queries, but Apple reserves "for kids" / "for children" wording in app metadata for the Kids Category (guideline 2.3.8; verify current text). The listing below uses "family" and "parents" and avoids "kids" in name, subtitle and keywords.
7. **Expected rating 13+ and the "Family Fun" name pull in opposite directions** (a 13+ app is blocked on a child's device that has Screen Time age limits, which fits the Tim 2026-11-18 decision that parents use it, but a parent searching "kids games" will not find it). Not a blocker; Tim should know it is a choice.

## 1. App icon

Apple's rules: 1024x1024 px PNG, **opaque (no alpha)**, square (iOS rounds the corners; do not pre-round), no screenshots of the UI, little or no text. The current file (`assets/images/icon.png`) is the interim "Hmm" mascot (PR #148, see `app-icon-final.md`): 1024x1024 RGB with no alpha, so it passes validation. `adaptive-icon.png`, `favicon.png`, `public/apple-touch-icon.png`, the iOS dark and tinted icons and `splash.png` (mascot on transparent) are filled in too (#148, #174). Still open: the vector redraw and the final A/B/C direction (Tim).

An icon change ships in the binary: **it needs a new build**, it cannot be changed in ASC alone.

### Concept directions

| | Concept | Idea | Risk |
|---|---|---|---|
| **A (recommended)** | **Split choice.** Square split on a diagonal: indigo `#5C54E8` (option A) and pink `#E8316A` (option B), one white "?" on the seam. | Reuses the two colours of the in-app A/B buttons, so the icon and the first screen agree. Two flat shapes plus one glyph reads at 29 px. | Close to "generic gradient + ?" if the seam is weak; mitigate with a crisp diagonal and a heavy glyph. |
| B | **Two bubbles.** Two overlapping speech bubbles marked "A" and "B" on the dark `#0F0F1A` splash colour. | Says "debate" and "conversation" directly. | Two letters plus two bubbles is busy at small sizes; competes with many chat-app icons. |
| C | **Fork in the road.** A path splitting in two, ending in two dots (indigo, pink). | Pure "choose one" metaphor, very simple. | Abstract; reads as a navigation or transit app. |

### How it will be produced (Tim picks)

| Option | What | Trade-off |
|---|---|---|
| **1 (recommended): code-drawn vector master** | I draw concept A as SVG in the repo (`assets/brand/icon.svg`), render with `sharp` (already a dependency) to a flattened 1024 PNG, and derive favicon, adaptive icon and splash from the same master. Tim approves a PNG before it goes in a build. | Fastest, reproducible, no licensing question, free. Flat geometric art only. |
| 2: designer brief | Brief below, 1 to 2 weeks, about US$100 to 300 (unverified estimate). | Best polish; slower; a build is already blocked, so no urgency to pay for it. |
| 3: AI-generated | An image model produces 4 to 8 candidates; Tim picks one. | Cheap, but output is raster, often has stray detail or text artefacts, and licence terms must be checked per tool. Needs Tim's approval of the tool and the result before use. |

Recommendation: **concept A, produced as option 1**, then ask a designer to polish only if the placeholder is judged weak after seeing it on a real home screen. Optional later: an iOS 26 layered icon (Icon Composer `.icon`); check Expo SDK 54 config support before spending time.

Designer brief (if option 2): "Icon for a conversation game called Would You Rather. Two choices, one question. Palette indigo `#5C54E8` and pink `#E8316A`, dark navy `#0F0F1A`. 1024x1024, flat, no text except at most one glyph, no transparency, no rounded corners, must read at 29 px. Deliver the master (SVG or layered file) and the flattened PNG."

## 2. Screenshots

### Required sizes (iPhone only)

Apple's ASC specification (verify at https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications before the first upload):

| Slot | Pixels (portrait) | Status |
|---|---|---|
| **iPhone 6.9"** | 1320x2868 (1290x2796 and 1260x2736 also accepted) | **Required.** Apple scales it down for smaller iPhones. |
| iPhone 6.5" | 1284x2778 or 1242x2688 | Only needed if no 6.9" set is given. The #87 kit already has both; ship 6.9" only to halve the work. |
| iPad 13" (2064x2752) | | **Not needed**: `supportsTablet: false`. |

Rules: PNG or JPEG, no alpha, 1 to 10 per size, exact dimensions. The first 3 show in search results, so they carry the pitch.

### Storyboard (7 shots; 1 to 3 do the selling)

Caption style: 3 to 6 words, large, one idea each. Backgrounds use the app palette (indigo to pink gradient, navy for dark shots). Device frames are optional; recommendation: **no physical frame, rounded screen on a gradient** (frames age badly with new devices).

| # | Caption | Screen | Capture note |
|---|---|---|---|
| 1 | **Pick a side.** | Question screen, option A selected | `/game/hl-1`. Good shot already exists (`04-question`); crop the empty lower half. |
| 2 | **Challenge a friend.** | Match share: "send a question and see if they pick the same" | Capture from the match-share flow (#92), not from the 20-vote state. |
| 3 | **Then see if they matched.** | The match result ("Your friend picked X") | Real state, no fake counts. |
| 4 | **8 categories, one tap.** | `/categories` grid | Shows The High Life, Moral Compass and the rest as shipped. |
| 5 | **Dinner table. Car ride.** | Kids & Family category screen | Supports the parent persona; use `kf-*` questions only. |
| 6 | **Free to start. Unlock what you like.** | Native paywall with the real store price | Needs a TestFlight build on a device or simulator; cannot come from the web render (it still shows the simulated sheet). Same image serves as the IAP review screenshot. |
| 7 | **Dark mode, too.** | Home in dark theme | Optional, lowest value; drop if the set feels padded. |

Swap in the real vote-split screen (**"See how everyone voted"**) as shot 2 only once a question has 20 or more real votes. Do not seed counts for the screenshot.

### How to capture and build them

| Path | How | Use |
|---|---|---|
| **A. Playwright on the web build (exists)** | `scripts/store/screenshots.mjs` already renders the app at 1320x2868 and 1284x2778 in headless Chromium. Header chrome differs from native. | Shots 1 to 5, 7 for a first draft. |
| **B. iOS Simulator (recommended for the final set)** | On a Mac with Xcode 26: boot an iPhone 17 Pro Max / 16 Pro Max simulator (6.9"), install the preview build, `xcrun simctl io booted screenshot out.png` per screen. Navigate with deep links (`xcrun simctl openurl booted would-you-rather://game/hl-1`). | Final set; real native chrome and real paywall. |
| **C. TestFlight device** | Screenshot on an iPhone 6.9" device. | Shot 6 if no simulator build exists. |

**Automation path** (agent can run all but the Mac step):
1. `scripts/store/capture.mjs` (extend the existing script): list of `{route, action, name}` entries from `store/ios/storyboard.json`, run in Playwright; later a `simctl` driver for the same list on a Mac.
2. `scripts/store/compose.mjs`: for each raw capture, draw gradient + caption + rounded screen with `sharp`, output **flattened** (`.flatten()`/`removeAlpha()`) 1320x2868 PNGs to `store/ios/screenshots/iphone-6.9/NN-name.png`.
3. A CI check that every file is exactly 1320x2868 with no alpha channel.
4. Upload through the ASC API once Tim approves the set: `appScreenshotSets` (display type `APP_IPHONE_69`), then per image `appScreenshots` reserve, PUT the upload operations, then PATCH `uploaded: true` with the MD5. Order is the `appScreenshotSets` relationship order. (Endpoint names from Apple's API reference; confirm against current docs when writing the workflow.)

## 3. App Store copy

Limits are Apple's. Counts below were measured, not estimated. Both variants avoid repeating words across name, subtitle and keywords (Apple indexes all three, so a repeat wastes characters) and avoid "kids".

### Keyword research and its limits

What it is based on: the repo's own `docs/seo/keyword-research-2026-11.md` (OpenSEO/DataForSEO, **web search** volume, US), plus a public App Store search for competitors on 2026-11-20. Useful signals: "would you rather app" 6,600 searches/month at difficulty 1; "would you rather game" 9,900; "road trip games" 3,533; "questions to ask your partner" 22,200; "this or that questions" about 32,000. Competitor listings (all "Would You Rather ..." with Party Game, Couples, Card Game, Questions App) own the exact name space, so the name needs a differentiator.

**Not verified:** App Store search popularity and difficulty (needs App Store Connect / Search Ads data or a paid ASO tool), whether any candidate name is free (ASC only tells you when you save it), and how "kids" terms rank (Google hides their volume; see the SEO doc). Treat keywords as a hypothesis and re-check the keyword field after 2 weeks of impressions in App Analytics.

### Name (max 30) and subtitle (max 30)

| | Name | Subtitle |
|---|---|---|
| **Variant A: family-first** | `Would You Rather? Family Fun` (28; this is the current ASC record name, so it is already reserved) | `Questions for the whole family` (30) |
| **Variant B: general** | `Would You Rather Debates` (24; availability unchecked) | `Pick a side. See who agrees.` (28) |

Recommendation: **A**, because the name is already secured, it matches the PRD parent persona, and "family" is a search term the competitors' exact-match names do not hold. B is the pick if Tim prefers the teen and couples audience, or if the 13+ rating makes "Family" feel mismatched.

### Promotional text (max 170, editable without a review)

- A: `Pick a side, then see if your family or friends picked the same. Hundreds of dilemmas, free to start, no account needed.` (120)
- B: `Pick a side, challenge a friend, and see if they chose the same. Free to start, no account, no subscription.` (108)

Avoid "hundreds of" if the shipped count changes: iOS v1 has 443 questions in the 8 categories (kit audit, 2026-11-18); keep the claim under that.

### Keywords (max 100, comma-separated, no spaces after commas)

- A: `game,icebreaker,road trip,this or that,date night,dilemma,conversation,parents,teens,couples,party` (98)
- B: `game,icebreaker,road trip,dinner,this or that,date night,dilemma,conversation,family,parents` (92)

Singular forms only (Apple matches plurals); no competitor names (rejection risk); no "kids".

### Description (max 4000) first paragraph, two variants

- **A (family):** `One question, two choices, a table full of opinions. Would You Rather turns dinner, car rides and waiting rooms into real conversation. Pick A or B, send the question to someone, and see if they chose the same.`
- **B (general):** `One question. Two impossible choices. An instant debate. Pick A or B, challenge a friend, and find out if they picked the same, then argue about why.`

Body (shared; replaces the #87 text, which listed "seven categories" and claimed a vote split that is not shown yet):

```
HOW IT WORKS
- Read a dilemma and tap the option you would choose.
- Send the question to a friend and see if they pick the same.
- As more people answer a question, you see how everyone voted.

EIGHT CATEGORIES
The High Life, Moral Compass, Social Blunders, Time Traveler, Career Climber, Tech Dystopia and Wildest Dreams for teens and adults, plus Kids & Family for the whole table. New questions are added over time.

FREE TO START
Every category has free questions to try. Moral Compass, Social Blunders, Career Climber and Tech Dystopia are free to play with an optional expansion, and Kids & Family is free. Other categories include a free preview.

UNLOCK WHAT YOU LIKE
- Unlock one category with a single purchase.
- Or unlock every category in one pack, including questions added later.
- No subscription. Restore Purchases is always available.

PRIVATE BY DEFAULT
No account and no sign-up. Your answers are stored anonymously to build vote totals. Kids & Family answers are stored with no device ID and no location.

Some categories contain mature themes and are meant for teens and adults. Kids & Family is designed for families to play together.
```

Check before submitting: the "Free to start" paragraph must match the shipped catalog (`constants/questions.ts`, `lib/catalog.ts`); the Privacy paragraph must match the live privacy policy and Decision 2.

### What's New (v1.0, max 4000)

`Welcome to Would You Rather. Pick a side, challenge a friend, and see if they chose the same. Eight categories, free to start.` (126)

### URLs and other fields

| Field | Value | Status |
|---|---|---|
| Support URL | https://www.wouldyourather.fyi/support (new page: contact email, FAQ, restore purchases help) | **Needs building and a mailbox.** The home page has no contact today. |
| Marketing URL | https://www.wouldyourather.fyi | live |
| Privacy Policy URL | https://www.wouldyourather.fyi/privacy | **blocker**: text is inaccurate until #85 and the #105 kids change are in |
| Terms | Apple's standard EULA, unless Tim supplies one (the app also has `/terms`) | |
| Copyright | `2026 Tim Fong` (confirm legal entity) | Tim |
| Primary category | Entertainment (kit recommendation, unchanged). Alternative: Games > Family, more parent discovery, more competition (unverified). | Tim |
| Price | Free with in-app purchases (`store/ios/iap.md`) | set |

## 4. TestFlight content

Internal testers (App Store Connect users, up to 100) need no review. **External testers need Beta App Review for the first build.** As of 2026-11-19 (PR #105) builds 5 and 6 are VALID in ASC; use build 6 (includes the kids vote fix).

| Field | Draft |
|---|---|
| Beta App Description | `Would You Rather is a conversation game: read a dilemma, pick A or B, send the question to a friend, and see if they pick the same. This beta lets you try all categories and test purchases with the App Store sandbox. Tell us what feels slow, confusing or fun.` |
| Feedback email | **Tim to choose** (same mailbox as the Support URL; recommendation `support@wouldyourather.fyi` once it exists) |
| Marketing URL / Privacy URL | as in section 3 |
| What to Test (per build) | see below |
| Beta App Review: contact | first name, last name, phone, email: **Tim types once** |
| Beta App Review: sign-in | none required |
| Beta App Review: notes | `No sign-in. Open a category and play. Premium categories show a paywall after the free questions; use an App Store sandbox account to test purchases. Restore Purchases is on the paywall. Kids & Family purchase screens show a "Grown-ups only" sum gate first. The app is not in the Kids Category.` |

What to Test (build 1):

```
1. Play 5 questions in The High Life and in Kids & Family.
2. Send a question to a friend with Share and check the link opens the same question.
3. Open a locked category, view the paywall, and buy with a sandbox account.
4. Delete and reinstall, then tap Restore Purchases.
5. Open Kids & Family, tap an unlock, and confirm the grown-ups gate appears.
Please report: crashes, anything that looks cut off on your iPhone model, wrong prices, anything confusing.
```

Groups: one internal group ("Core", Tim and testers added as ASC users), one external group ("Friends", public link off) once review passes.

## 5. Compliance that shapes the listing

### 5.1 Age rating

Apple's scale is now 4+, 9+, 13+, 16+, 18+ and the questionnaire has new required questions (in-app controls, capabilities, medical or wellness, violent themes); Apple's deadline to answer was 2026-01-31, so a new app must answer them at creation. Answers (from the #87 audit of the shipped bank; **re-verify against the new questionnaire wording in ASC**):

| Topic | Answer | Evidence |
|---|---|---|
| Profanity or crude humor | Infrequent/mild | gross-out and embarrassment questions |
| Alcohol, tobacco, drugs | Infrequent/mild | `hl-16`, `hl-17` (winery, wine cellar) |
| Mature or suggestive themes | Infrequent/mild | 3 Moral Compass dilemmas (cheating, crime) |
| Sexual content, violence, gambling, medical | None | none found in the 8 shipped categories |
| Unrestricted web access, user-generated content, messaging, advertising, loot boxes | No | none in the app |
| In-app purchases | Yes | non-consumable unlocks |
| Parental controls / age assurance in app | No (a purchase gate only on kids content) | `ParentalGate` |

Expected result: **13+** (Apple computes it). Do not raise or lower it by hand to market the app. If the Date Night or Party Pack banks (PR #66, drafts) ever ship on iOS, re-run this audit first.

### 5.2 Kids Category or general

Requirements to apply for the Kids Category (guidelines 1.3 and 5.1.4; Apple's page was not retrievable in this session, so the points below are from public summaries, **verify before deciding**): the whole app is for kids (age band 5 and under, 6 to 8 or 9 to 11), no third-party advertising, **no third-party analytics that collect identifiable data**, no links out or purchases without a parental gate, and strict data minimisation.

| Check | This app | Result |
|---|---|---|
| Whole app suitable for a child age band | 8 categories; 7 are teen/adult, expected 13+ | **Fails** unless adult categories are removed on iOS |
| Third-party analytics | PostHog (native not gated by path, see section 0) | **Fails** unless PostHog is removed from the iOS build |
| Third-party SDK for purchases | RevenueCat (anonymous user id; developers report review friction with SDKs that touch the advertising identifier; unverified for this SDK version) | **Risk** |
| Persisted ID | anonymous ID persisted outside kids routes | **Fails** for a whole-app Kids listing |
| Parental gate on purchases | exists for kids content only (PR #83) | partial |
| Links out | share sheet, website links | need gating |

| Path | What | Pros | Cons |
|---|---|---|---|
| **A (recommended): general listing, family-friendly, 13+, not Kids Category** | Ship as in this spec; keep the kids set as a free category with the existing gate and no-tracking rules. | Matches the product and the Tim 2026-11-18 decision; fewest changes; one app, one catalog. | Not shown in the Kids Category; 13+ means kids' devices with age limits cannot install it; "Family Fun" name overstates the audience. |
| B: later, separate kids-only app | New bundle id, only Kids & Family, no analytics, own listing and review. | The right way to enter the Kids Category and reach parents of 6 to 12. | A second app to build, review and maintain; do it after the parent loop is proven (PRD: native after web targets). |
| C: put this app in the Kids Category | Remove the 7 adult categories and PostHog (and likely rework RevenueCat) on iOS. | Kids Category visibility. | Guts the product the PRD describes (couples, teens); big rework; Apple scrutiny of the whole binary. |

**Recommend A now, B as a post-launch decision.** **Decided: A** (Tim, 2026-11-19: "I'm fine with the general App Store's listing rated 13+ because of payments and so forth. So it's general listing.").

### 5.3 App Privacy ("nutrition label")

Updated 2026-11-20 for Tim's decisions of 2026-11-19: **general listing (not Kids Category)** and **PostHog on iOS, adult screens only**. The #87 `store/ios/privacy.md` table is superseded where it differs. Tim enters these in App Store Connect (no public API, unverified), about 10 clicks. **None is used for tracking** (no data is linked to third-party data for ads, no data broker sharing), so: no ATT prompt, no `NSUserTrackingUsageDescription`, and "Data Used to Track You" = none.

| Apple data type | Collected | Linked to the user | Used for tracking | Purpose | Source |
|---|---|---|---|---|---|
| Purchases > Purchase History | Yes | Yes (anonymous RevenueCat app user id) | No | App Functionality | RevenueCat |
| Identifiers > Device ID | Yes | Yes (random anonymous id, not Apple's IDFA or IDFV) | No | Analytics, App Functionality | PostHog, vote API (adult screens only) |
| Usage Data > Product Interaction | Yes | Yes (via the anonymous id) | No | Analytics, App Functionality | PostHog events and votes (question, choice, time) |
| Location > Coarse Location | Yes | Yes (via the anonymous id) | No | App Functionality | Vote API stores country and region from the request; IP address is not stored |
| Diagnostics > Crash or performance data | No | | | | none collected by the app |
| Contact info, User content, Browsing, Search, Health, Financial, Contacts, Sensitive info | No | | | | |

Kids & Family screens: **no analytics, no device id, no region**; a vote there stores only question, option and time. Enforced in code: `analyticsOnFor()` (route and event-property guards, native fail-closed) and `castVote()` for `kf-*` questions; covered by `tests/unit/analytics-core.test.ts` and `tests/unit/votes-client.test.ts`.

Caveats to re-check before Tim enters the answers:
- The PostHog React Native SDK keeps its own anonymous id only if a storage package is installed; none is today, so it is in memory (a new id each launch). If persistence is added later, the id is still never sent from kids screens, but the answers above stay the same.
- Events captured on an adult screen can be flushed shortly after the user opens a kids screen (PostHog batches). Nothing new is captured on kids screens.
- **RevenueCat starts at app launch on every route** (`UnlockedProvider` is mounted at the root and calls `getEntitlements()`/`getPrices()`), so its anonymous app user ID exists on the device even when the first screen is Kids & Family. The privacy policy says so; it is not linked to Kids & Family answers. Whether to defer RevenueCat on kids routes is an open code decision (#114).
- Backend storage counts as collection: re-check this table whenever an API route stores a new field or an SDK is added.
- The privacy policy page (`/privacy`) must say the same; it is updated in the same release.

### 5.4 Export compliance

HTTPS only. `ITSAppUsesNonExemptEncryption: false` is already in `app.json`, so builds do not ask "Missing Compliance". Nothing for Tim to do unless a custom crypto library is added.

## 6. Ordered steps: who does what

URLs are ASC pages as of today; menu names move, so each marked "(verify)" is the usual path, not a confirmed link.

| # | Step | Who | Link or note |
|---|---|---|---|
| 1 | Decide: icon concept and production method; name variant; support email; Kids path; PostHog on iOS | **Tim** | issue linked from the PR |
| 2 | Build the icon master and derive favicon, adaptive icon, splash | Agent | needs Tim's approval of the PNG |
| 3 | Add `/support` page and mailbox; update privacy policy (#85, #105) | Agent (page, policy text); **Tim** (mailbox, approves live legal text) | blocker for review |
| 4 | Merge #105 (Expo SDK 54) so new builds pass Apple's SDK check | **Tim** (needs his review) | PR #105 |
| 5 | New preview build with the final icon, upload, confirm VALID | Agent | `apple-upload.yml`, `apple-ops.yml` `builds` |
| 6 | Paid Apps agreement, banking and tax | **Tim** (Account Holder) | https://appstoreconnect.apple.com/business |
| 7 | RevenueCat App Store app and `appl_` key into the EAS `preview` env | Agent (API) + **Tim** (In-App Purchase key upload) | per #75 plan |
| 8 | Capture and compose screenshots (web draft first) | Agent | `store/ios/screenshots/iphone-6.9/` |
| 9 | Native paywall capture on the TestFlight build | **Tim** (device) or Agent on a Mac | needs step 5 |
| 10 | TestFlight: internal group, beta description, feedback email, What to Test, Beta App Review contact | Agent via ASC API (`betaAppLocalizations`, `betaBuildLocalizations`, `betaGroups`); **Tim** types contact name and phone | https://appstoreconnect.apple.com/apps/6836653723/testflight/groups |
| 11 | Sandbox tester and device purchase checks | **Tim** | https://appstoreconnect.apple.com/access/users/sandbox |
| 12 | Listing text, keywords, URLs, copyright, category, price, age rating | Agent via ASC API (`appInfoLocalizations`, `appStoreVersionLocalizations`, `ageRatingDeclarations`); **Tim** can paste by hand instead | https://appstoreconnect.apple.com/apps/6836653723 |
| 13 | Upload approved screenshots | Agent via ASC API (`appScreenshotSets`, `appScreenshots`) | after Tim approves the set |
| 14 | IAP localizations and review screenshots | Agent via API after step 9 | `store/ios/iap.md` |
| 15 | App Privacy answers | **Tim** | https://appstoreconnect.apple.com/apps/6836653723/distribution/privacy (verify) |
| 16 | Production build, submit for review | **Tim's explicit go**, then Agent | never without a relayed go |

Agent automation needs a new **write** workflow (the existing `apple-ops.yml` is read-only): `apple-metadata.yml`, manual dispatch, **dry run by default**, an `apply` input, reading text from `store/ios/listing-final.json` so Tim reviews exactly what is sent, using the same `ASC_*` secrets. It is a separate PR and needs Tim's go; this spec does not add it.

## 7. Open questions for Tim

See the linked issue for the decision list with a recommendation each.

## 8. Required fields before "Add for Review" (audit 2026-11-25, ticket #243)

Nothing here is entered in App Store Connect. Method: Apple ops (GET only: `app`, `versions`, `iap`, `iap-screenshots`, `iap-images`, run 2026-11-25), Tim's screenshot of the version page, and the repo files cited. Apple ops cannot read localizations, age rating, App Privacy, pricing or review details, so those are **unverified** unless Tim's screenshot shows them. "Blank" means blank in Tim's screenshot or not set in any file; Tim confirms on the page.

### 8.1 Live reads

| Fact | Value | Source |
|---|---|---|
| App | "Would You Rather? Family Fun", bundle `com.timfong888.wouldyourather`, SKU `wyr-ios-001`, primary locale en-US | Apple ops `app` |
| Version | 1.0, `PREPARE_FOR_SUBMISSION`, release type `AFTER_APPROVAL` (automatic), created 2026-11-18 | Apple ops `versions` |
| Build on the version | build 23 attached, icon asset present (120x120) | Apple ops `versions` |
| In-app purchases | 8 exist, all non-consumable, all `READY_TO_SUBMIT`, family sharing off | Apple ops `iap` |
| IAP review screenshots | 8 of 8 uploaded, state COMPLETE | Apple ops `iap-screenshots` |
| IAP promotional images | none (optional) | Apple ops `iap-images` |
| Support URL page | live (HTTP 200), shows contact `tim@wouldyourather.fyi` | `curl https://www.wouldyourather.fyi/support` |
| Privacy page | live (HTTP 200), mentions PostHog (adult screens only), RevenueCat, kids exclusions | `curl https://www.wouldyourather.fyi/privacy` |

Note: `store/ios/iap.md` still says "none exist"; that is stale (ticket #238 row E).

### 8.2 Field table

State: **blank** (empty in Tim's screenshot or nowhere set), **set** (read live), **unverified** (cannot read; Tim checks). Character counts were measured with `node`.

| # | Page | Field | State | Proposed value | Limit |
|---|---|---|---|---|---|
| 1 | Version | App Previews | blank (0 of 3) | None for v1. Optional; skip until screenshots are done. | 886x1920 |
| 2 | Version | Screenshots | blank (0 of 10) | 6 screenshots, section 8.3 | 1206x2622 |
| 3 | Version | Promotional Text | blank | `Pick a side, then see if your family or friends picked the same. Free questions in every category, optional upgrades, no account needed.` (136) | 170 |
| 4 | Version | Description | unverified (draft in `listing-final.json`) | Section 8.4 (1,259 chars, Family wording proposed for Tim). Replaces the "Free to start" paragraph so it states no count (#238). | 4000 |
| 5 | Version | Keywords | **pending data** | Leave open. Placeholder only, not for entry: `game,icebreaker,road trip,this or that,date night,dilemma,conversation,parents,teens,couples,party` (98). See 8.5. | 100 |
| 6 | Version | Support URL | unverified | `https://www.wouldyourather.fyi/support` (page live, 200) | |
| 7 | Version | Marketing URL | unverified | `https://www.wouldyourather.fyi` | |
| 8 | Version | What's New | unverified | Not shown for a first version (unverified). If asked: `Welcome to Would You Rather. Pick a side, challenge a friend, and see if they chose the same.` (93) | 4000 |
| 9 | Version | Copyright | unverified | `2026 Tim Fong` (legal name open in #114) | |
| 10 | Version | Build | **set** | Build 23, already attached. Confirm it is the build Tim wants after #238 code lands; a new build means re-attaching. | |
| 11 | Version | In-App Purchases | unverified | Attach all 8 products to this version | |
| 12 | Version | Version release | set: automatic after approval | Recommend **manual** release, so launch waits for #238 and a Tim go. Tim decides. | |
| 13 | Version | Sign-in required | unverified | No | |
| 14 | App Review | Contact first name, last name, phone, email | unverified | **Tim types**: personal data, not in any file | |
| 15 | App Review | Review notes | unverified | Section 8.6 | 4000 |
| 16 | App Review | Attachment | unverified | None | |
| 17 | App Information | Name | unverified (record name is this) | `Would You Rather? Family Fun` (28) | 30 |
| 18 | App Information | Subtitle | unverified | `Questions for the whole family` (30) | 30 |
| 19 | App Information | Privacy Policy URL | unverified | `https://www.wouldyourather.fyi/privacy` (live, 200). Needs Tim's legal read first (#114). | |
| 20 | App Information | Primary category | unverified | Entertainment (listing.md). Secondary: none, or Games > Family. Tim decides. | |
| 21 | App Information | Content rights | unverified | "No, it does not contain, show or access third-party content." Questions are written with AI help and reviewed (PRD). Tim confirms. | |
| 22 | App Information | Age rating questionnaire | unverified | Answers in section 5.1; expected 13+ (Apple computes) | |
| 23 | App Compliance (new) | Contents of this section | **unverified** | Not readable via API; I do not know what it asks. Likely items: export compliance (already `ITSAppUsesNonExemptEncryption: false` in `app.json`) and, if sold in the EU, Digital Services Act trader status. Tim opens it and reports each question. | |
| 24 | App Compliance | EU trader status | unverified | Likely not needed with US-only availability (row 29); confirm in the section. If EU storefronts are added later, Tim decides then; a trader status makes a contact address and phone public on the EU listing (unverified how ASC shows it). | |
| 25 | App Privacy | Data types collected | unverified | Section 5.3 table (purchase history, device ID, product interaction, coarse location; none used for tracking) | |
| 26 | App Accessibility | Accessibility labels | unverified | Declare nothing until each feature is tested on a device. I have not verified VoiceOver, Dynamic Type or contrast. Believed voluntary for now (unverified). | |
| 27 | Ratings and Reviews | Any required field | unverified | None expected; age rating is under App Information (verify). | |
| 28 | Monetization | Price | unverified | Free, base territory USA | |
| 29 | Monetization | Availability | unverified | **United States only** (Tim, 2026-11-25, his direct words; not read from ASC). Remove every other storefront. | |
| 30 | Monetization | Paid Apps agreement, banking, tax | unverified | **Tim** (Account Holder). Needed for in-app purchases. | |
| 31 | In-App Purchases | 8 products: name, description, price, screenshot | **set** (`READY_TO_SUBMIT`; screenshots COMPLETE) | Keep. Display text "Every question in X" may be wrong after #238; do not edit until Tim answers #238 decision 2. | |
| 32 | Version | Advertising Identifier (asked at submit) | unverified | No (no ads, no ATT, section 5.3). Tim confirms RevenueCat does not read the IDFA. | |
| 33 | Version | Export compliance (asked at submit) | set in `app.json` | Not asked per build; nothing to do (section 5.4). | |

Not required for v1, skip: In-App Events, Custom Product Pages, Product Page Optimization, Promo Codes, Asset Library, Game Center, iPad screenshots (`supportsTablet: false`), Apple Watch.

Claims in the copy and where they come from: eight categories and kids set (`store/ios/iap.md`, `constants/iosV1.ts`); anonymous answers and kids exclusions (live privacy page); no subscription and Restore Purchases (`store/ios/iap.md`). The vote-split bullet is kept as "as more people answer", matching `listing-final.json` and the PRD's 20-vote rule.

### 8.3 Screenshot set

**Exact size: 1206x2622 px, portrait, PNG, no alpha.** Tim's screenshot of the upload slot lists 1179x2556 and 1206x2622 (and landscape). The earlier plan (section 2) used 1320x2868; that size is not on the list Tim saw, so do not use it. I pick 1206x2622 because an iPhone 16 Pro or 17 Pro takes screenshots at exactly that size (unverified for Tim's phone: check Settings > General > About > Model Name).

**How many: 6** (first 3 show in search; 4 more than the minimum buys nothing). The 10-slot limit is not a target.

| # | Caption (max 36, counted) | Screen | Capture note |
|---|---|---|---|
| 1 | `Pick a side.` (12) | Question screen, option A selected | `/game/hl-1` |
| 2 | `Challenge a friend.` (19) | Share / send-a-question flow | real state, no counts |
| 3 | `See if they matched.` (20) | Shared-question match result | real state |
| 4 | `Eight categories, one tap.` (26) | Categories grid | iOS v1 catalog (8) |
| 5 | `Dinner table. Car ride.` (23) | Kids & Family category | `kf-*` questions only |
| 6 | `Free to start. Unlock what you like.` (36) | Native paywall at the real store price | needs a device or simulator; do not state a free count |

Dropped from section 2: "Dark mode, too" (padding). The real vote-split shot stays out until a question has 20 or more real votes (PRD). Captions say nothing about free counts (#238).

**Without a Mac** (pick one, recommendation first):
1. **Tim's iPhone, 10 minutes.** Install build 23 or later from TestFlight, open each of the 6 screens, take a screenshot (side button + volume up), AirDrop or share to Files, send the 6 raw files. The native paywall (shot 6) comes only from here or option 2. I compose captions on a gradient with `sharp` and output 1206x2622 flat PNGs to `store/ios/screenshots/iphone-6.3/`.
2. **macOS CI runner.** `.github/workflows/ios-simulator-smoke.yml` already builds the app for the simulator on `macos-15`. A new workflow (separate PR, needs Tim's go) would boot an iPhone 16 Pro simulator, open each deep link with `xcrun simctl openurl`, and save `xcrun simctl io booted screenshot`. Slower; paywall store price is unverified in a simulator without StoreKit config.
3. **Web render (draft only).** `scripts/store/screenshots.mjs`: set a device to 402x874 CSS px at scale 3 (= 1206x2622). Header chrome differs from native and the paywall is simulated, so Apple may object (guideline 2.3.3). Fine for review of captions, not for upload.

Upload: Tim drags the files into the 6.3" slot (human step below), or an ASC API workflow after his approval of the set.

### 8.4 Description (1,259 characters) — wording **proposed, for Tim**

The Family-category wording below is a proposal (2026-11-25): it replaces "Kids & Family" to lower the risk under guideline 5.1.4 (section 9.2). Tim decides. Screenshots are unchanged; screenshot 5 still says Kids & Family and keeps that risk.

```
One question, two choices, a table full of opinions. Would You Rather turns dinner, car rides and waiting rooms into real conversation. Pick A or B, send the question to someone, and see if they chose the same.

HOW IT WORKS
- Read a dilemma and tap the option you would choose.
- Send the question to a friend and see if they pick the same.
- As more people answer a question, you see how everyone voted.

EIGHT CATEGORIES
The High Life, Moral Compass, Social Blunders, Time Traveler, Career Climber, Tech Dystopia and Wildest Dreams for teens and adults, plus a Family category for the whole table. New questions are added over time.

FREE TO START
Every category has free questions to try. Want more? Unlock a category with an optional upgrade.

UNLOCK WHAT YOU LIKE
- Unlock one category with a single purchase.
- Or unlock every category in one pack, including questions added later.
- No subscription. Restore Purchases is always available.

PRIVATE BY DEFAULT
No account and no sign-up. Your answers are stored anonymously to build vote totals. Family category answers are stored with no device ID and no location.

Some categories contain mature themes and are meant for teens and adults. The Family category is designed for families to play together.
```

Changed from `listing-final.json`: the "Free to start" paragraph no longer names categories as free or says "free to play with an optional expansion" (removed by #238). Re-check once #238 settles whether Kids & Family stays free.

### 8.5 Keywords: pending data

Tim's view (2026-11-25): "would you rather" is the right term. Two things to check before it goes in the field:
- Apple indexes the app name, subtitle and keywords together. "Would You Rather" is already in the name, so repeating it in the keyword field spends characters for no extra match. The value of the term is in the name; the keyword field should add *other* words.
- Search Ads popularity (Tim's account) measures how often a term is searched, not how well this app would rank. Competitors with exact "Would You Rather ..." names own that space (section 3). Popularity, plus the number of apps ranking for a term, together decide.

Verified: nothing about search volume. Unverified: popularity of any term, including "would you rather". When Tim has the data, send me the terms with their popularity and I fill the 100 characters (comma-separated, no spaces after commas, singular forms, no competitor names, no "kids").

### 8.6 App Review notes (replace the stale text in `listing.md`)

```
No sign-in is needed. Open a category and play. Categories show a paywall after the free questions; purchases use in-app purchase. Use a sandbox account to test: the all-categories pack, or any single category. Restore Purchases is on the paywall screen.

Kids & Family: any purchase screen opened from Kids & Family content shows a "Grown-ups only" gate first (solve a three-number sum). The app is not in the Kids Category.
```

`ParentalGate.tsx` exists in `components/`. Whether it ships in build 23 is unverified; Tim checks on a device before sending these notes.

### 8.7 Human-only steps for Tim

All links open App Store Connect for app 6836653723; menu paths move, so each is "(verify)". Paste the value shown.

| # | Step | Link | Paste |
|---|---|---|---|
| 1 | Open the version page | https://appstoreconnect.apple.com/apps/6836653723/distribution/ios/version/inflight (verify) | |
| 2 | Promotional Text | same page | `Pick a side, then see if your family or friends picked the same. Free questions in every category, optional upgrades, no account needed.` |
| 3 | Description | same page | section 8.4 block |
| 4 | Support, Marketing URL | same page | `https://www.wouldyourather.fyi/support` and `https://www.wouldyourather.fyi` |
| 5 | Copyright | same page | `2026 Tim Fong` (or the legal entity) |
| 6 | Screenshots | same page, 6.3" slot | the 6 PNGs, 1206x2622, after Tim approves the set |
| 7 | Attach in-app purchases | same page, In-App Purchases section | all 8 |
| 8 | App Review contact | same page, App Review | Tim's first and last name, phone, email |
| 9 | Review notes | same page | section 8.6 block |
| 10 | Name and Subtitle | https://appstoreconnect.apple.com/apps/6836653723/distribution/info (verify) | `Would You Rather? Family Fun` and `Questions for the whole family` |
| 11 | Privacy Policy URL, category, content rights | same page | `https://www.wouldyourather.fyi/privacy`; Entertainment; "No" third-party content |
| 12 | Age rating questionnaire | same page | section 5.1 answers |
| 13 | App Compliance (new) | left menu, App Compliance | read each question to me, then answer; trader status is Tim's call (row 24) |
| 14 | App Privacy | https://appstoreconnect.apple.com/apps/6836653723/distribution/privacy (verify) | section 5.3 table |
| 15 | Price and availability | left menu, Monetization / Pricing and Availability | Free; USA base; availability: United States only |
| 16 | Paid Apps agreement, banking, tax | https://appstoreconnect.apple.com/business | Account Holder only |
| 17 | Keywords | version page | **wait** for Search Ads data (8.5) |
| 18 | Add for Review | version page | **only after Tim's explicit go** |

### 8.8 Decisions for Tim

1. **Screenshots: iPhone capture or CI?** Recommend your iPhone (option 1): fastest, real paywall.
2. **Keyword field:** hold until Search Ads data, and do not repeat "would you rather". Recommend hold.
3. **Release type:** manual, not automatic. Recommend manual.
4. **Territories: decided, United States only** (Tim, 2026-11-25). EU trader status is then expected not to apply (unverified); revisit if more storefronts are added.
5. **Ship before or after #238?** IAP text ("Every question in X") and paywall copy may change. Recommend fix #238 first; screenshots 6 and the IAP review screenshots need re-capture if the paywall changes.
6. **Accessibility:** skip labels for v1 until tested. Recommend skip.
7. **Category name mismatch:** the app calls the category "Kids & Family"; the proposed store text (8.4) says "Family category". Do you rename the category in the app, accept the mismatch, or keep "Kids & Family" in the store text? Nothing is renamed in this PR. Recommend accept the mismatch for v1; section 8.6 (review notes) keeps "Kids & Family" on purpose because it describes the app to App Review.

## 9. Age rating options and Kids Category bands (2026-11-25)

Answers Tim's question of 2026-11-25 ("what are the other child ranges, and tradeoffs"). Sources were read on 2026-11-25; each claim names its page. Apple computes the final rating from the questionnaire, so the "this app" column is an expectation, not a result.

Sources:
- [A] Age rating values: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- [B] Set an app age rating: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- [C] Kids category (design safe and age-appropriate experiences): https://developer.apple.com/app-store/kids-apps/
- [D] App Review Guidelines 1.3 and 5.1.4: https://developer.apple.com/app-store/review/guidelines/

### 9.1 The two scales

| Scale | Values | Source |
|---|---|---|
| App Store age rating | 4+, 9+, 13+, 16+, 18+ | [A] |
| Kids category age band ("Made for Kids") | 5 and under, 6-8, 9-11 | [C] |

The two are separate. The band is an extra choice on top of the rating, and it is only offered when the calculated rating is 4+ or 9+ [B]. Apple's definition of 13+ includes "Infrequent alcohol, tobacco, or drug use or references" [A]. The #87 audit found 2 of 443 questions with wine references (`hl-16`, `hl-17`), which is why 13+ is expected. Whether removing them would give 9+ is unverified; Apple computes it.

### 9.2 Options and the rules that apply to this app

| Option in App Store Connect | Age bands | Third-party analytics (PostHog on adult screens) | In-app purchases | Adult categories | Source |
|---|---|---|---|---|---|
| **1. Calculated rating, "Not Applicable"** (expected 13+) | none | Allowed; disclose in App Privacy and the privacy policy. Kids content must still follow 5.1.4. | Allowed. A parental gate on kids purchase screens is good practice here, not required for this option. | Allowed | [B], [D] 5.1.4 |
| **2. Override to a higher rating** (16+ or 18+) | none | same as 1 | same as 1 | Allowed | [B] |
| **3. Made for Kids, 5 and under** | 5 and under | Apple says kids apps should not send personally identifiable or device information to third parties, "even in sections intended for adults", unless a parent consents. Third-party analytics are allowed only in limited cases (no IDFA, nothing identifiable). | Only behind a parental gate | Not workable: the rating must calculate to 4+ or 9+ [B], and the whole app must follow Kids category rules [C] | [B], [C], [D] 1.3 |
| **4. Made for Kids, 6-8** | 6-8 | as 3 | as 3 | as 3 | same |
| **5. Made for Kids, 9-11** | 9-11 | as 3 | as 3 | as 3 | same |

Notes that apply to every option:
- The "Made for Kids" selection cannot be changed once App Review approves it, and the app and all later updates must follow the Kids category guidelines [B].
- Metadata rule (5.1.4, which points to 2.3.8): apps not in the Kids category "cannot include any terms in app name, subtitle, icon, screenshots or description that imply the main audience for the app is children" [D]. This listing says "Family Fun", "Questions for the whole family" and "Kids & Family". I read "family" as not implying children as the main audience, but this is my judgment, not Apple's; App Review decides. Risk is highest for the "Kids & Family" wording in the description and screenshot 5.
- Kids category purchase rule: no purchasing opportunities except behind a parental gate [D] 1.3.

### 9.3 Which option fits this app

**Option 1 (calculated rating, not Made for Kids).** Reasons, each from the sources above:
1. The app has seven teen and adult categories. A Made for Kids selection needs a calculated 4+ or 9+ rating [B], and the adult content (and wine references) points to 13+ [A].
2. PostHog runs on adult screens. For the Kids category Apple says kids apps should not send identifiable or device information to third parties even in adult sections [C]. Removing PostHog from the whole iOS app would be needed.
3. This matches the decision already recorded in section 5.2 (Tim, 2026-11-19: general listing, rated 13+).

The tradeoff is real: a 13+ app is not shown in the Kids category and is not installable on a child's device with age limits under 13. A later separate kids-only app (section 5.2, path B) is the way into the Kids category.

### 9.4 Open items
- The final rating comes from Apple's questionnaire in the App Information page; Tim enters the answers (row 22).
- The description now proposes "Family" wording instead of "Kids & Family" (8.4, proposed for Tim). Screenshot 5 (8.3) still says Kids & Family and is unchanged; Tim decides whether to change it. Option 1 stays the recommendation; Tim decides after reading the table.
