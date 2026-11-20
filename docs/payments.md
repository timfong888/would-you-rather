# Payments (RevenueCat)

Status (issue #126, 2026-11-20): the real paywall is wired on **iOS** (App Store via
`react-native-purchases`) and **web** (RevenueCat Web Billing / Stripe via
`@revenuecat/purchases-js`). The old free "Pay" sheet is now a test-only switch that
never exists on production. What is left is store setup by Tim (checklist below).

## Product model (Tim, issue #54, 2026-11-18)

| Product | Store id | Entitlement | Price |
|---|---|---|---|
| All categories | `wyr_premium_all` | `premium_all` | $4.99 |
| One category (x7) | `wyr_unlock_<category_id with _>` | `cat_<category-id>` | $1.99 |

A category is open if `premium_all` OR `cat_<id>` is active (`lib/catalog.ts`,
`isCategoryEntitled`). Access is by entitlement, so questions added later are
included. `kids-family` is free and has no product.

**iOS v1 leaves out Midnight Secrets and Deep Desires** (Tim, 2026-11-18: "leave
them out"). native builds hide them (`constants/iosV1.ts`, `constants/platformFilter.native.ts`)
and the catalog has no products for them, so iOS v1 sells the pack plus seven
category unlocks (8 products). They stay on the web. The catalog is derived from
`constants/questions.ts` minus that exclusion list.

One RevenueCat offering, `default`, holds one package per product (package
id = entitlement id).

## Files

- `lib/catalog.ts` ids, prices, entitlement rule. Pure; unit-tested. Adding a product (e.g. the kids products in `docs/specs/kids-family-categories.md`) is a catalog entry plus `npm run rc:sync`; no UI change.
- `lib/access.ts` the access rule the app uses: owner access, or an entitlement, or (test builds only) a test unlock.
- `lib/purchases-core.ts` iOS logic, SDK injected, unit-tested. `lib/purchases.native.ts` binds `react-native-purchases`.
- `lib/purchases-web-core.ts` web logic, SDK injected, unit-tested. `lib/purchases.ts` binds `@revenuecat/purchases-js`, loaded only when needed (separate chunk).
- `lib/testUnlockPolicy.ts` where the free test unlock may exist (never production).
- `contexts/UnlockedContext.tsx` entitlements on launch, on purchase/restore, on every foreground and every 5 minutes. Access is React state, so purchased questions open at once, no reload.
- `app/unlock/[id].tsx` the paywall: buy the category, "or unlock every category", Restore Purchases, "Have a code?" (owner code, web and native dev builds only). The simulated sheet renders only on test builds.
- `scripts/check-web-build.mjs` web build guard (env + production bundle scan). `scripts/check-rc-keys.mjs` EAS guard.
- `scripts/revenuecat/sync-catalog.ts` (`npm run rc:sync -- --app <id>`) idempotent catalog sync for Test Store, App Store and Web Billing apps.

## Web (RevenueCat Web Billing, Stripe)

- Key `EXPO_PUBLIC_RC_WEB_KEY` per Vercel environment: **Preview** `rcb_sb_...` (sandbox, Stripe test mode), **Production** `rcb_...` (live). A key on the wrong deploy (sandbox or Test Store key on production, live key on a preview or local build) fails the build and is also refused at runtime, so previews can never take a real charge.
- No RevenueCat id is created while browsing. The first purchase creates an anonymous id (`$RCAnonymousID:...`) and stores it in this browser (`wyr_rc_web_user`). On kids routes that only happens after the parental gate.
- Web purchases stay with the browser they were made in. Restore on web re-reads that browser's id; it cannot find a purchase made in another browser (see blind spots).
- The paywall shows $1.99 / $4.99 until a purchase starts; the Web Billing checkout shows the real price before any charge.

## Free test unlock (test builds only)

| Build | `EXPO_PUBLIC_DEPLOY_ENV` | Test unlock |
|---|---|---|
| Vercel Production | `production` (from `VERCEL_ENV`) | never; build fails if `EXPO_PUBLIC_TEST_UNLOCK` is set; exported bundle scanned for the test UI |
| Vercel Preview | `preview` | only with `EXPO_PUBLIC_TEST_UNLOCK=1` (Preview scope) |
| Local `npm run build:web`, `npm start`, `npm run web` | `development` (the scripts default it) | only with `EXPO_PUBLIC_TEST_UNLOCK=1` |
| EAS `production` | `production` (eas.json) | never; `check-rc-keys` fails the build |
| EAS `preview` | `preview` | off |
| EAS `preview-test` | `preview` | on (TestFlight build for flow testing) |

**Release hazard, and the guard.** A `preview-test` build goes to the same App Store
Connect app as the release. To stop one being picked for App Review, every build with
the test unlock gets app version **99.<major>.<minor>** of the real one (1.0.0 -> 99.1.0,
`app.config.js`). App Store Connect only attaches builds whose version matches the App
Store version (1.0.0), so a test build cannot be submitted, and 99.x stays above every
approved release, so test uploads keep working after launch. Use internal TestFlight
testers only for these builds, and never create an App Store version 99.x.
Build 11 predates this guard: it is 1.0.0 *with* the test unlock.
**Never submit build 11**; expire it in TestFlight once the 99.1.0 build is installed.
Running bare `npx expo start` without the npm script leaves the deploy env unset,
which counts as production: no test unlock and no sandbox web key (fails closed).
Do not add a `.env.development` for this: `expo export` loads it too.

Production also ignores unlocks stored by the old simulated checkout (`wyr_unlocked_categories`): on production, access comes from RevenueCat entitlements or owner access only.

## Kids and family

Tim, 2026-11-18: "no tracking on kids but parents should be using it." Any purchase
screen opened for kids/family content (`FAMILY_FRIENDLY` in `constants/questions.ts`)
shows a parental gate first (`components/ParentalGate.tsx`, `lib/parentalGate.ts`: a
three-number sum a young child will not solve by tapping; a wrong answer issues a new
one), and no analytics event fires on that path. Today `kids-family` is a free
category with nothing for sale, so this is defense in depth for when paid kids
content exists; the listing kit's review notes mention it.

## Keys

| Where | Variable | Value |
|---|---|---|
| EAS `development` | `EXPO_PUBLIC_RC_IOS_KEY` | `test_...` Test Store |
| EAS `preview` (TestFlight) | `EXPO_PUBLIC_RC_IOS_KEY` | `appl_...` (App Store sandbox in TestFlight) |
| EAS `production` | `EXPO_PUBLIC_RC_IOS_KEY` | `appl_...` |
| Vercel Preview | `EXPO_PUBLIC_RC_WEB_KEY` | `rcb_sb_...` |
| Vercel Production | `EXPO_PUBLIC_RC_WEB_KEY` | `rcb_...` |

All are public SDK keys, set in EAS / Vercel, never in the repo. Owner code: native
release builds never offer it (`lib/ownerAccessPolicy.ts`); grant yourself access in
release builds with a RevenueCat promotional entitlement.

## Tim's setup checklist

State on 2026-11-20 (read by the agent): RevenueCat project `proj686a561d` has only the
Test Store app; App Store Connect has **0** in-app purchases for app 6836653723 (Apple ops
`iap`); EAS `preview` has no environment variables.

1. **Paid Apps agreement, banking, tax** (Account Holder): https://appstoreconnect.apple.com/business . Products do not load in sandbox until the agreement is Active.
2. **Create the 8 in-app purchases in App Store Connect**: https://appstoreconnect.apple.com/apps/6836653723/distribution/iaps , "+", type **Non-Consumable**, for each row of `store/ios/iap.md` (Product ID, Reference Name, price $4.99 for `wyr_premium_all`, $1.99 for each `wyr_unlock_*`, English (U.S.) display name and description from the table). Availability: all countries. The review screenshot can wait until App Review; sandbox works without it once the product is "Ready to Submit".
   (Alternative: a write workflow `apple-iap-create.yml` that creates them from `lib/catalog.ts` with the ASC key. Agents will not add or run it without your explicit go.)
3. **In-App Purchase key for RevenueCat**: https://appstoreconnect.apple.com/access/integrations/api , tab "In-App Purchase", Generate. Download the `.p8` once.
4. **RevenueCat App Store app**: https://app.revenuecat.com/projects/proj686a561d/apps/new , App Store, bundle ID `com.timfong888.wouldyourather`; upload the In-App Purchase key (`.p8`, Key ID, Issuer ID `fdddb19e-f1ba-4bf9-94cf-6fe46ee043ce`). Tell the agent the new app id (`app...`); it runs `npm run rc:sync -- --app <id>`, which creates the 8 products (same ids), attaches each to its entitlement (`premium_all`, `cat_<category>`) and to the matching package in offering `default`.
5. **`appl_` key into EAS**: copy the app's public SDK key (`appl_...`) to https://expo.dev/accounts/blockstitch/projects/would-you-rather/environment-variables as `EXPO_PUBLIC_RC_IOS_KEY`, environment **preview** (later also **production**), visibility "Plain text". Then the agent rebuilds `preview-test`.
6. **Stripe + RevenueCat Web Billing (test mode)**: https://app.revenuecat.com/projects/proj686a561d/apps/new , "Web Billing", connect Stripe (OAuth, test mode is fine), app name "Would You Rather Web", support email, default currency USD. Copy the **Sandbox** public key (`rcb_sb_...`). Give the agent the app id; it runs `rc:sync` (if RevenueCat asks for prices in the dashboard: $4.99 pack, $1.99 each).
7. **Vercel env vars** (sandbox only until the durable-id blocker below is solved): https://vercel.com/ (project would-you-rather, Settings, Environment Variables): `EXPO_PUBLIC_RC_WEB_KEY` = `rcb_sb_...` for **Preview** only; optionally `EXPO_PUBLIC_TEST_UNLOCK` = `1` for **Preview** only. Production gets the live `rcb_...` key only at go-live (your call). Never set `EXPO_PUBLIC_TEST_UNLOCK` on Production (the build fails if you do).
8. **Sandbox tester**: https://appstoreconnect.apple.com/access/users/sandbox , "+", a new email you control (not your real Apple ID), region United States. On the iPhone: Settings, App Store, Sandbox Account, sign in when the purchase sheet asks. TestFlight purchases are free and show "[Environment: Sandbox]".

## Test script

**A. TestFlight build 15 (`preview-test`, version 99.1.0, today, before setup).** No RevenueCat key yet, so this checks the flow, not billing.
1. Install build 15 (99.1.0) from TestFlight. Open a paid category (e.g. The High Life), answer the free questions until the paywall.
2. Tap "START N MORE CONVERSATIONS". The sheet shows "TEST MODE: NO CHARGE". Tap Pay. Success screen, then START PLAYING: question N+1 appears.
3. Back out: the category shows unlocked without restarting the app.
4. Open another paid category's paywall, tap "Or unlock every category · $4.99". The sheet shows All Categories, TEST MODE: NO CHARGE. Pay: every premium category opens.
5. Open a locked question's link directly (e.g. /game/<id> on web): you land on that category's paywall, never a blank page.

**B. TestFlight after checklist steps 1-5 and 8 (rebuild of `preview-test`).**
1. Open The High Life, reach the paywall. Price shows $1.99 (from the App Store).
2. Tap Unlock. Apple's sheet shows **[Environment: Sandbox]**; confirm with the sandbox tester. You are not charged.
3. Success, START PLAYING: question N+1 appears at once.
4. Open another paid category: still locked. Tap "Or unlock every category · $4.99", confirm: every paid category opens.
5. Delete the app, reinstall from TestFlight, open the paywall, tap **Restore Purchases**: both unlocks return.
6. Cancel the Apple sheet once: no error, nothing unlocked.
7. In RevenueCat (Customers, sandbox data on) the customer shows `cat_high-life` and `premium_all`.

**C. Web preview after checklist steps 6-7.** Use the Vercel preview link of this PR.
1. Open a paid category, reach the paywall, tap Unlock. RevenueCat's checkout opens (test mode).
2. Email: any address you read. Card **4242 4242 4242 4242**, any future date (e.g. 12/34), any CVC (123), any ZIP.
3. Pay: question N+1 appears at once, no reload. Reload the page: still unlocked.
4. Open a private window: locked (web purchases stay with the browser). Card **4000 0000 0000 0002** shows a decline and unlocks nothing.
5. The payment appears in Stripe test mode and in RevenueCat (sandbox).

**D. Production stays safe.** On https://www.wouldyourather.fyi : the paywall never shows "TEST MODE"; without the live key, Unlock says purchases are unavailable and unlocks nothing.

## Blind spots / decisions for Tim

- **Go-live blocker for live web charges: the web buyer's id is not durable.** Access hangs on one anonymous RevenueCat id in `localStorage`. Safari (and every iOS browser) deletes script-written storage after 7 days of browsing without visiting the site, so an iPhone buyer who returns two weeks later finds the category locked, and Restore cannot find the purchase. The same applies to clearing site data, private windows and other devices. Fine for sandbox testing; **do not set the live `rcb_` key on Production until the id is tied to something durable** (RevenueCat redemption links / email identity, or a server-issued id in an HTTP-only cookie). Needs your call on sign-in vs email: #135.
- **Midnight Secrets and Deep Desires** are paid on web but have no product (they were left out of the iOS catalog). On web their Unlock says "not available". Decide: add web-only products (config in `lib/catalog.ts`), or keep them unsold.
- **Old free unlocks are dropped on production**: visitors who "bought" through the old simulated sheet lose that access (they never paid).
- **Owner code on production web** still unlocks everything for anyone with the code (hash brute-forceable offline). Unchanged here.

## Sandbox test plan

Legend: AUTO = already run by an agent against the Test Store; DEVICE = needs a dev build or TestFlight and a sandbox Apple ID.

| # | Check | How | Result |
|---|---|---|---|
| 1 | Catalog sync is idempotent | `npm run rc:sync` twice | AUTO: pass (second run created 0 objects) |
| 2 | Offering as the SDK sees it | `GET /v1/subscribers/<id>/offerings` with the `test_` key | AUTO: pass (`default` current, 8 packages with the right product ids) |
| 3 | Entitlement lookup | grant `cat_high-life` to a user, read subscriber with the SDK key | AUTO: pass |
| 4 | Gating rule, catalog, wrapper (product selection, cancel vs error, restore, no key, listener cleanup) | `npm test` | AUTO: pass |
| 5 | Web build unaffected, SDK not in web bundle | `expo export --platform web` | AUTO: pass |
| 6 | iOS bundle builds | `expo export --platform ios` | AUTO: pass |
| 7 | Buy one category: only that category unlocks | dev build, Test Store key | DEVICE |
| 8 | Buy the all-categories pack: every paid category unlocks | dev build | DEVICE |
| 9 | Unlock survives kill and relaunch | dev build | DEVICE |
| 10 | Cancel the purchase sheet: no error shown | dev build | DEVICE |
| 11 | Restore after reinstall | dev build, same store account | DEVICE |
| 12 | Offline/missing offering: sane message | airplane mode | DEVICE |
| 13 | Refund or expiry revokes access after the next app foreground | revoke in RevenueCat customer view, background and reopen the app | DEVICE |
| 14 | Promo grant unlocks without paying | grant in RevenueCat | DEVICE |
| 15 | Parental gate: a kids/family paywall shows the gate first; wrong answer gives a new challenge; no analytics events fire | dev build, open `/unlock/kids-family` | DEVICE |
| 16 | Same on App Store sandbox | `preview` build via TestFlight, `appl_` key, sandbox Apple ID | DEVICE, after #75 and store products exist |

Check each result in the RevenueCat customer view.

## Where Tim's approvals sit

1. Prices (done 2026-11-18: $4.99 / $1.99).
2. Screenshots and listing text (Unit 3 PR).
3. Go-live: real-money products, production keys, App Review submission. Not done by agents.

## Superseded

PR #44 (single `premium_pack` entitlement) and the nine-product model in
PR #62's runbook. The phases in #62 that remain valid: EAS setup, store
connection, store product creation, sandbox acceptance, go-live.
