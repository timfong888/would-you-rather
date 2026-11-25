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
category unlocks (8 products today; 17 with the 9 kids and teen category products, D22 #255). They stay on the web. The catalog is derived from
`constants/questions.ts` minus that exclusion list.

One RevenueCat offering, `default`, holds one package per product (package
id = entitlement id).

## Files

- `lib/catalog.ts` ids, prices, entitlement rule. Pure; unit-tested. Adding a product (e.g. the kids products in `docs/specs/kids-family-categories.md`) is a catalog entry plus `npm run rc:sync`; no UI change.
- `lib/access.ts` the access rule the app uses: owner access, or an entitlement, or (only while `EXPO_PUBLIC_WEB_FREE_UNLOCK` is on) a free web unlock.
- `lib/purchases-core.ts` iOS logic, SDK injected, unit-tested. `lib/purchases.native.ts` binds `react-native-purchases`.
- `lib/purchases-web-core.ts` web logic, SDK injected, unit-tested. `lib/purchases.ts` binds `@revenuecat/purchases-js`, loaded only when needed (separate chunk).
- `lib/testUnlockPolicy.ts` deploy environment parsing and the temporary web free unlock rule.
- `contexts/UnlockedContext.tsx` entitlements on launch, on purchase/restore, on every foreground and every 5 minutes. Access is React state, so purchased questions open at once, no reload.
- `app/unlock/[id].tsx` the paywall: buy the category, "or unlock every category", Restore Purchases, "Have a code?" (owner code, web and native dev builds only).
- `scripts/check-web-build.mjs` web build guard (env + production bundle scan). `scripts/check-rc-keys.mjs` EAS guard.
- `scripts/revenuecat/sync-catalog.ts` (`npm run rc:sync -- --app <id>`) idempotent catalog sync for Test Store, App Store and Web Billing apps. In the cloud agent container, run it with `NODE_USE_ENV_PROXY=1` so Node's fetch goes through the proxy that injects the RevenueCat key (without it: 401 Invalid API key). Done for the App Store app `appa3c231f9f4` on 2026-11-20.

## Web (RevenueCat Web Billing, Stripe)

- Key `EXPO_PUBLIC_RC_WEB_KEY` per Vercel environment: **Preview** `rcb_sb_...` (sandbox, Stripe test mode), **Production** `rcb_...` (live). A key on the wrong deploy (sandbox or Test Store key on production, live key on a preview or local build) fails the build and is also refused at runtime, so previews can never take a real charge.
- No RevenueCat id is created while browsing. The first purchase creates an anonymous id (`$RCAnonymousID:...`) and stores it in this browser (`wyr_rc_web_user`). On kids routes that only happens after the parental gate.
- Web purchases stay with the browser they were made in. Restore on web re-reads that browser's id; it cannot find a purchase made in another browser (see blind spots).
- The paywall shows $1.99 / $4.99 until a purchase starts; the Web Billing checkout shows the real price before any charge.

## Temporary production web free unlock (`EXPO_PUBLIC_WEB_FREE_UNLOCK`)

Tim, 2026-11-21 ("128 b"): until web payments exist (blocked on #135), the production
web paywall unlocks for free.

- **On:** Vercel, project would-you-rather, Settings, Environment Variables:
  `EXPO_PUBLIC_WEB_FREE_UNLOCK` = `1`, scope **Production** (add Preview to try it there), then redeploy.
- **Off:** delete that variable from Vercel Production and redeploy production (Deployments, latest production, Redeploy). `EXPO_PUBLIC_*` values are compiled into the bundle, so it only changes with a new deploy.
- What users see: the price reads $1.99 with "FREE FOR NOW · NO PAYMENT NEEDED". One tap on the CTA opens every question in the category (as the $1.99 purchase does on iPhone). "Or unlock every category · $4.99 · free for now" opens every grown-up category. There is no fake checkout. The success screen then appears. Analytics logs `paywall_cta_clicked` with `payment_method: free_unlock`.
- Unlocks are stored in the browser (`wyr_unlocked_categories`), as were unlocks from the old simulated checkout. Both count while the flag is on. **When it is turned off, they stop counting**: those visitors see the paywall again.
- Web only. iOS/Android never get it (`Platform.OS === 'web'` is checked inline, and `check-rc-keys` fails any EAS build that sets the variable).
- Guards (`scripts/check-web-build.mjs`): the value must be exactly `1`. A production build fails if it is combined with a live `rcb_` web key, so remove the flag when web payments go live. With the flag off, the production bundle is scanned for "FREE FOR NOW" and fails if it is still there. It never brings back the removed test unlock: `EXPO_PUBLIC_TEST_UNLOCK` fails every build, and "TEST MODE" never ships.

## Testing purchases without paying

Tim, 2026-11-20 (decision A): iOS is tested with Apple sandbox purchases on normal 1.x
TestFlight builds: the real paywall, a free sandbox account.

Tim, 2026-11-21 ("Test Store yes"): web previews and local web builds test the real purchase
flow against **RevenueCat's Test Store**, which never charges. The old free "test unlock"
(`EXPO_PUBLIC_TEST_UNLOCK`, a simulated checkout sheet) is removed; any build that sets it fails.

| Build | `EXPO_PUBLIC_DEPLOY_ENV` | `EXPO_PUBLIC_RC_WEB_KEY` allowed |
|---|---|---|
| Vercel Production | `production` (from `VERCEL_ENV`) | live `rcb_...` only (at go-live); `test_` and `rcb_sb_` fail the build |
| Vercel Preview | `preview` | Test Store `test_...` (or Web Billing sandbox `rcb_sb_...`); live `rcb_` fails the build |
| Local `npm run build:web`, `npm start`, `npm run web` | `development` (the scripts default it) | same as Preview |
| Any EAS build (iOS/Android) | per profile | n/a; `check-rc-keys` fails any EAS build with `EXPO_PUBLIC_TEST_UNLOCK` or `EXPO_PUBLIC_WEB_FREE_UNLOCK` |

The Test Store app is `app4a3e1a9c34` in RevenueCat. All 8 products are attached to their entitlement and to their package in offering `default` (same ids as the App Store), so the preview paywall sells exactly what the app sells. Its public key is under https://app.revenuecat.com/projects/proj686a561d/apps/app4a3e1a9c34 (API keys). It is a public SDK key, but it lives in Vercel, not in the repo.

TestFlight builds 14 and 15 (version 99.1.0) and build 11 (1.0.0) predate decision A and carry
the old test unlock: internal testers only, **never submit them**, expire them once a sandbox
build is installed.
Running bare `npx expo start` without the npm script leaves the deploy env unset,
which counts as production: no Test Store or sandbox web key (fails closed).
Do not add a `.env.development` for this: `expo export` loads it too.

Unlocks stored by the old simulated checkout (`wyr_unlocked_categories`) count only while the temporary production web free unlock is on.

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
   (Alternative: the Apple ops action `iap-create` creates all 8 with prices and English (U.S.) text from `store/ios/iap.md` through the ASC API. It is in the repo but is only run with your explicit go. The review screenshots are in `store/ios/iap-review/` and are uploaded by the Apple IAP review screenshots workflow.)
3. **In-App Purchase key for RevenueCat**: https://appstoreconnect.apple.com/access/integrations/api , tab "In-App Purchase", Generate. Download the `.p8` once.
4. **RevenueCat App Store app**: https://app.revenuecat.com/projects/proj686a561d/apps/new , App Store, bundle ID `com.timfong888.wouldyourather`; upload the In-App Purchase key (`.p8`, Key ID, Issuer ID `fdddb19e-f1ba-4bf9-94cf-6fe46ee043ce`). Tell the agent the new app id (`app...`); it runs `npm run rc:sync -- --app <id>`, which creates the 8 products (same ids), attaches each to its entitlement (`premium_all`, `cat_<category>`) and to the matching package in offering `default`.
5. **`appl_` key into EAS**: copy the app's public SDK key (`appl_...`) to https://expo.dev/accounts/blockstitch/projects/would-you-rather/environment-variables as `EXPO_PUBLIC_RC_IOS_KEY`, environment **preview** (later also **production**), visibility "Plain text". Then the agent builds `preview` (normal 1.x version) and submits it to TestFlight.
6. **Stripe + RevenueCat Web Billing (test mode)**: https://app.revenuecat.com/projects/proj686a561d/apps/new , "Web Billing", connect Stripe (OAuth, test mode is fine), app name "Would You Rather Web", support email, default currency USD. Copy the **Sandbox** public key (`rcb_sb_...`). Give the agent the app id; it runs `rc:sync` (if RevenueCat asks for prices in the dashboard: $4.99 pack, $1.99 each).
7. **Vercel env vars** (sandbox only until the durable-id blocker below is solved): https://vercel.com/ (project would-you-rather, Settings, Environment Variables): `EXPO_PUBLIC_RC_WEB_KEY` = the Test Store key (`test_...`) for **Preview** only (or, once step 6 is done, the Web Billing sandbox key `rcb_sb_...` to test Stripe itself). Production gets the live `rcb_...` key only at go-live (your call). `EXPO_PUBLIC_TEST_UNLOCK` no longer exists: every build fails if it is set.
8. **Sandbox tester**: https://appstoreconnect.apple.com/access/users/sandbox , "+", a new email you control (not your real Apple ID), region United States. On the iPhone: Settings, App Store, Sandbox Account, sign in when the purchase sheet asks. TestFlight purchases are free and show "[Environment: Sandbox]".

## Test script

**A. TestFlight after checklist steps 1-5 and 8 (`preview` build, version 1.x, Apple sandbox).**
1. Open The High Life, reach the paywall. Price shows $1.99 (from the App Store).
2. Tap Unlock. Apple's sheet shows **[Environment: Sandbox]**; confirm with the sandbox tester. You are not charged.
3. Success, START PLAYING: question N+1 appears at once.
4. Open another paid category: still locked. Tap "Or unlock every category · $4.99", confirm: every paid category opens.
5. Delete the app, reinstall from TestFlight, open the paywall, tap **Restore Purchases**: both unlocks return.
6. Cancel the Apple sheet once: no error, nothing unlocked.
7. In RevenueCat (Customers, sandbox data on) the customer shows `cat_high-life` and `premium_all`.

**B. Web preview.** Use the Vercel preview link of this PR.
0. Test Store flow (needs only the `test_` key as `EXPO_PUBLIC_RC_WEB_KEY` on Vercel Preview): tap Unlock; RevenueCat's Test Store purchase dialog opens and lets you choose a successful or failed purchase. Nothing is charged. Success unlocks the category, or every category from the pack; question N+1 appears without a reload. A failed or cancelled test purchase unlocks nothing. A locked question's link lands on its paywall.
Steps 1-5 test Stripe itself and need checklist step 6 plus the `rcb_sb_` key on Preview:
1. Open a paid category, reach the paywall, tap Unlock. RevenueCat's checkout opens (test mode).
2. Email: any address you read. Card **4242 4242 4242 4242**, any future date (e.g. 12/34), any CVC (123), any ZIP.
3. Pay: question N+1 appears at once, no reload. Reload the page: still unlocked.
4. Open a private window: locked (web purchases stay with the browser). Card **4000 0000 0000 0002** shows a decline and unlocks nothing.
5. The payment appears in Stripe test mode and in RevenueCat (sandbox).

**C. Production stays safe.** On https://www.wouldyourather.fyi : the paywall never shows "TEST MODE". With `EXPO_PUBLIC_WEB_FREE_UNLOCK=1`, it shows "FREE FOR NOW", and Unlock opens the category with no checkout. Without the flag and without the live key, Unlock says purchases are unavailable and unlocks nothing.

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
