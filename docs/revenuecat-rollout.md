# RevenueCat rollout runbook (SAT-926)

The task list for replacing the simulated paywall with real purchases on iOS,
Android and web. Each task is marked **Human** (needs a person in a console)
or **Agent** (an Orchestrator session can do it end to end), with its
dependencies and a definition of done. Work top to bottom; tasks in the same
phase can run in parallel unless a dependency says otherwise.

## Current state (as of 2026-11-17)

- **Payments are simulated.** `app/unlock/[id].tsx` `handlePay` waits on a
  timer and then calls `unlock()`. `handleRestorePurchases` only reads local
  state.
- **Unlocks persist only on web** (`localStorage` in
  `contexts/UnlockedContext.tsx`). Native builds forget them on restart.
- **No native build pipeline.** There is no `eas.json` and no
  `react-native-purchases`. Nothing can reach the App Store or Play until the
  Expo app is compiled with EAS (Phase 1).
- **No user accounts.** Purchases will be tied to an anonymous RevenueCat ID
  per device/browser. See "Known limitations".
- **RevenueCat project:** "Would You Rather" (`proj686a561d`). It has only the
  default Test Store app (`app4a3e1a9c34`) and no products, entitlements or
  offerings.
- **Bundle ID / package:** `com.timfong888.wouldyourather` (both platforms,
  from `app.json`).

## Product model (derived from the code)

`constants/questions.ts` sells **one non-consumable unlock per category**:

| Category | Tier | What the unlock opens |
|---|---|---|
| high-life, midnight-secrets, time-traveler, deep-desires, wildest-dreams | premium | everything after the first 3 free questions |
| moral-compass, social-blunders, career-climber, tech-dystopia | free | the volume 2 expansion pack |

RevenueCat mapping, with **identical identifiers in every stage and store**:

- Entitlement per category: `cat_<category-id>` (e.g. `cat_high-life`).
- Product per category: `wyr_unlock_<category_id_with_underscores>` (e.g.
  `wyr_unlock_high_life`). Apple and Google product IDs use this same string.
- One offering per category: `cat_<category-id>`, one package
  `$rc_lifetime`. The unlock screen loads the offering for the category it is
  showing.
- Owner access becomes a **granted** entitlement (via the API) instead of a
  client-side code; see `docs/owner-access.md`.

> Decision for Tim: confirm prices (one price tier for all, or premium vs
> expansion priced differently). Pricing is set per store in Phase 4.

## Stages and keys

This is the target state once RC-2.2 lands; until then the only "simulation"
is the timer in `app/unlock/[id].tsx` described above. After RC-2.2 the code
never changes between stages. Only the keys do.

| Stage | Purchases | RevenueCat key used by the app | Where it is set |
|---|---|---|---|
| Dev / automated | Simulated by the RevenueCat Test Store | `test_…` | EAS `development` profile, Vercel Preview |
| Staging / acceptance | Store sandboxes, Stripe test mode | `appl_…`, `goog_…`, `rcb_sb_…` | EAS `preview` profile, Vercel Preview |
| Production | Real | `appl_…`, `goog_…`, `rcb_…` | EAS `production` profile, Vercel Production |

Public SDK keys are safe to ship to the client as
`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `EXPO_PUBLIC_RC_WEB_KEY`.
Secret v2 keys (`sk_…`) are never prefixed `EXPO_PUBLIC_`. Use **two
separate keys**, each with only the permissions it needs:

| Key | Holder | Permissions |
|---|---|---|
| Orchestrator key | Network secret on the agents' cloud environment (RC-0.1) | project configuration read/write, customer information read/write |
| Server key | Vercel variable `REVENUECAT_SECRET_KEY` (Preview and Production) | customer information read/write only (read for entitlement checks, write for owner-access grants in RC-2.4) |

The production server never holds a key that can change products,
entitlements or offerings, and either key can be rotated without touching
the other.

---

## Phase 0: Orchestrator access (do first)

### RC-0.1 Give the Orchestrator's worker environment RevenueCat access. **Human**
- In the claude.ai cloud environment where Orchestrator sessions run, add a
  **network secret** for host `api.revenuecat.com`, header `Authorization`,
  prefix `Bearer`, using the **Orchestrator key** (see "Stages and keys").
- Attach the `timfong888/would-you-rather` repository to that environment.
- Delete the plain-text `REVENUE_CAT_SECRET` variable from the claude.ai
  cloud environment settings (it was added there by hand, not in this repo);
  the network secret replaces it.
- **Done when:** an agent session there gets HTTP 200 from
  `GET https://api.revenuecat.com/v2/projects` (send any dummy Bearer value;
  the proxy injects the real one).

### RC-0.2 Give the Orchestrator Vercel and Expo access. **Human**
- Vercel: the environment allows `api.vercel.com` / `vercel.com`, and the
  Vercel connector (or a token as a network secret) is available.
- Expo: create an Expo account access token and add it as a network secret
  for `api.expo.dev` (header `Authorization`, prefix `Bearer`); allow
  `expo.dev` and `api.expo.dev`. EAS CLI also reads `EXPO_TOKEN`; give it a
  dummy value so the proxy substitutes the real one.
- **Done when:** an agent can list Vercel env vars for this project and run
  `npx eas-cli whoami`.

## Phase 1: Native build pipeline (Expo / EAS)

### RC-1.1 Add EAS build configuration. **Agent**
- Depends on: RC-0.2.
- Add `expo-dev-client`, run `eas init` (writes the EAS project ID into
  `app.json`), and create `eas.json` with `development` (dev client,
  internal), `preview` (internal distribution, store sandbox keys) and
  `production` (store) profiles. Set the `EXPO_PUBLIC_RC_*` variables per
  profile with EAS environment variables, not in the repo.
- Add a build-time check that fails a `production` build if any
  `EXPO_PUBLIC_RC_*` value starts with `test_` or `rcb_sb_`.
- **Done when:** the PR is merged and `eas build --profile development
  --platform all` succeeds.

### RC-1.2 Apple developer prerequisites. **Human**
- Active Apple Developer Program membership.
- App Store Connect: create the app record for bundle ID
  `com.timfong888.wouldyourather`.
- Sign the **Paid Apps agreement**; complete banking and tax. Without this,
  products silently fail to load, in sandbox and production.
- Let EAS manage signing credentials on the first iOS build (interactive
  Apple login, so a human runs this once: `eas credentials` or the first
  `eas build -p ios`).
- **Done when:** a `preview` iOS build installs through TestFlight.

### RC-1.3 Google Play prerequisites. **Human**
- Google Play Console developer account; create the app with package
  `com.timfong888.wouldyourather`.
- Add your Google account(s) as **license testers** (Settings → License
  testing).
- The first build upload is RC-2.6: it has to include the billing permission
  that RC-2.2 adds.
- **Done when:** the Play Console app exists and license testers are set.

## Phase 2: Test Store, fully automated (no money, no store accounts)

### RC-2.1 Create entitlements, products and offerings in the Test Store. **Agent**
- Depends on: RC-0.1; product model and prices confirmed.
- Using the RevenueCat v2 API on project `proj686a561d`, app
  `app4a3e1a9c34`: create the 9 entitlements, 9 non-consumable products,
  attach each product to its entitlement, and create the 9 offerings with a
  `$rc_lifetime` package. Make the script idempotent and commit it as
  `scripts/revenuecat/sync-catalog.mjs`, reading identifiers from
  `constants/questions.ts` so the catalog can't drift from the code.
- Fetch the Test Store public key (`test_…`) and record it in EAS
  `development` and Vercel Preview.
- **Done when:** running the script twice gives the same result, and `GET
  …/offerings` lists 9 offerings.

### RC-2.2 Integrate the SDK in the app. **Agent**
- Depends on: RC-1.1, RC-2.1.
- Add `react-native-purchases` (native) and `@revenuecat/purchases-js` (web).
  Write one `lib/purchases.ts` wrapper with `configure`, `getOffering(categoryId)`,
  `purchase(categoryId)`, `restore()` and `getEntitlements()`, and pick the
  key with `Platform.OS`.
- `contexts/UnlockedContext.tsx`: derive `isUnlocked` from active
  entitlements (`cat_<id>`), keep local storage only as an offline cache.
- `app/unlock/[id].tsx`: replace the simulated `handlePay` /
  `handleRestorePurchases` with the wrapper; show the store price from the
  offering; handle a user cancel without showing an error. Keep the existing
  analytics events, and add `purchase_completed` / `purchase_failed`.
- **Done when:** in a development build and on web with the Test Store key,
  buying, cancelling and restoring all work, and unit tests cover the
  wrapper with the SDK mocked.

### RC-2.3 Server-side entitlement check and webhook. **Agent**
- Depends on: RC-0.1, RC-0.2, RC-2.1.
- Human sub-step: create the **server key** (customer information read/write
  only) in RevenueCat and add it to Vercel as `REVENUECAT_SECRET_KEY`.
- `api/revenuecat/webhook`: verify a shared `Authorization` header
  (`REVENUECAT_WEBHOOK_AUTH`), ignore events whose `environment` doesn't
  match the deployment (Production deployments ignore `SANDBOX`), log
  purchase, refund and cancellation events.
- `api/_lib/entitlements`: look up a customer's active entitlements via
  `GET /v2/projects/{id}/customers/{app_user_id}` using
  `REVENUECAT_SECRET_KEY`. Use this wherever the server serves locked
  content.
- Create the webhook in RevenueCat via the API, pointing at the Production
  URL; create a second one for Preview if useful.
- **Done when:** a Test Store purchase produces a webhook the endpoint
  accepts (HTTP 200), and a request with a bad auth header gets 401.

### RC-2.4 Owner access as a granted entitlement. **Agent**
- Depends on: RC-2.3.
- Replace the client-side owner code check with a server endpoint that, after
  verifying the code, calls RevenueCat's grant-entitlement API for every
  `cat_*` entitlement on that customer.
- Move the digest from `EXPO_PUBLIC_OWNER_ACCESS_SHA256` (shipped in the
  client bundle today, so it can be brute-forced offline) to a server-only
  Vercel variable `OWNER_ACCESS_SHA256`. The endpoint hashes the submitted
  code, compares in constant time, and rate-limits attempts. Remove the
  `EXPO_PUBLIC_` variable once the endpoint is live.
- Update `docs/owner-access.md` to describe the server-side check.
- **Done when:** redeeming the code on a fresh device unlocks every category,
  it survives an app reinstall followed by Restore, and no owner-access
  digest appears in the client bundle.

### RC-2.5 Automated acceptance tests on the Test Store. **Agent**
- Depends on: RC-2.2, RC-2.3.
- The repo has no CI yet (no `.github/workflows`, no `test` script). Add a
  GitHub Actions workflow that runs on every PR: install, type-check, unit
  tests, then the Playwright suite against the PR's Vercel Preview URL
  (wait for the Vercel deployment status, then use its URL).
- Playwright suite (web, Test Store key): free questions playable, locked
  ones gated, purchase unlocks the category, restore after clearing storage,
  cancel leaves it locked.
- **Done when:** the workflow runs on every PR and passes.

### RC-2.6 Upload the first Android build to Play internal testing. **Human**
- Depends on: RC-1.3, RC-2.2.
- Run `eas build --profile preview --platform android` (an agent can run
  this), then upload the `.aab` to the **internal testing** track (the first
  upload must be done by hand in Play Console; later ones can use
  `eas submit`). Google blocks creating in-app products until a build that
  includes the billing permission has been uploaded.
- **Done when:** the internal-track build installs on a tester device.

## Phase 3: Store sandboxes (no money, real store integrations)

### RC-3.1 Connect the App Store to RevenueCat. **Human**
- Depends on: RC-1.2.
- App Store Connect → Users and Access → Integrations → In-App Purchase:
  generate a key (.p8). In RevenueCat, add an **App Store** app with the
  bundle ID and upload the .p8, key ID and issuer ID.
- Set App Store Server Notifications (production and sandbox URLs) to the
  URL RevenueCat shows.
- Create a sandbox tester (App Store Connect → Users and Access → Sandbox).
- **Done when:** RevenueCat shows the App Store app as connected; tell the
  agent its app ID for RC-4.2.

### RC-3.2 Connect Google Play to RevenueCat. **Human**
- Depends on: RC-2.6.
- Create a Google Cloud service account, grant it access in Play Console
  (Users and permissions: view financial data, manage orders), upload its
  JSON to a RevenueCat **Play Store** app. Credentials can take up to 36
  hours to start working.
- Set up Real-time developer notifications with the Pub/Sub topic RevenueCat
  generates.
- **Done when:** RevenueCat shows valid credentials; tell the agent its app ID
  for RC-4.2.

### RC-3.3 Connect Stripe for Web Billing. **Human**
- Create or use a Stripe account; in RevenueCat add a **Web Billing** app and
  connect Stripe (OAuth in the dashboard).
- **Done when:** RevenueCat shows the sandbox (`rcb_sb_…`) and production
  (`rcb_…`) public keys for Web Billing.

## Phase 4: Store products and prices

### RC-4.1 Create 9 Apple and 9 Google products (18 total). **Human**
- Depends on: RC-3.1, RC-3.2, prices confirmed.
- Create each `wyr_unlock_*` as a **non-consumable** in-app purchase (Apple)
  and a **one-time product** (Google), with the agreed price, name and
  description. Apple also needs a review screenshot per product.
- This stays manual on purpose: the store APIs need short-lived signed
  tokens (Apple ES256 JWT, Google service account OAuth), which a static
  network secret can't provide, and the alternative is putting
  full-account store keys inside the sandbox.
- **Done when:** all 18 products are Ready to Submit (Apple) / Active (Google).

### RC-4.2 Attach store products in RevenueCat; set store keys. **Agent**
- Depends on: RC-3.1, RC-3.2, RC-3.3, RC-4.1.
- Extend `sync-catalog.mjs` so that, inside RevenueCat:
  - for the App Store and Play Store apps, it creates product **entries**
    that reference the store product IDs created by hand in RC-4.1. It never
    calls Apple or Google APIs.
  - for the Web Billing app, it creates the actual products, with prices.
  - it attaches all of them to the same entitlements and offering packages.
- Set `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`,
  `EXPO_PUBLIC_RC_WEB_KEY` (sandbox for `preview` and Vercel Preview,
  production for `production` and Vercel Production).
- **Done when:** each offering has iOS, Android and web products, and the
  `preview` build shows store prices.

## Phase 5: Sandbox acceptance

### RC-5.1 Web sandbox acceptance. **Agent**
- Depends on: RC-4.2.
- Run the RC-2.5 Playwright suite against Vercel Preview with the Web Billing
  sandbox key, paying with Stripe test cards (success, decline, 3-D Secure).
- **Done when:** passing, and the purchases show as `SANDBOX` in RevenueCat.

### RC-5.2 iOS and Android sandbox acceptance. **Human** (agent writes the checklist)
- Depends on: RC-4.2; a fresh `preview` build on TestFlight and the internal
  track.
- On a device signed in as the sandbox tester / license tester: buy one
  premium and one expansion unlock, cancel a purchase, delete and reinstall,
  then Restore. Check that the webhook received the events.
- **Done when:** the checklist passes on both platforms.

## Phase 6: Production release

### RC-6.1 Submit the builds. **Human**
- `eas build --profile production` and `eas submit` (an agent can run these
  once credentials exist). Submit the in-app purchases **with** the first app
  version in App Store Connect; Apple reviews them together.
- **Done when:** both apps are approved and live.

### RC-6.2 Real-money smoke test, once. **Human**
- Buy one unlock per platform with a real card, confirm it shows as
  `PRODUCTION` in RevenueCat and the webhook fired, then refund it.
- **Done when:** confirmed on iOS, Android and web.

### RC-6.3 Monitoring. **Agent**
- Alert (PostHog or email) on webhook failures, error spikes in
  `purchase_failed`, and refunds. Enable RevenueCat's own email alerts.

---

## Known limitations (decide before Phase 6)

- **No cross-platform restore.** With anonymous IDs, buying on web doesn't
  unlock on iOS, and reinstalling on another device restores only through the
  same store account. Fixing this needs user accounts (sign-in) and calling
  `Purchases.logIn(userId)`. Fine for launch; revisit if people complain.
- **Store fees and pricing differ.** Apple and Google take 15–30%; Stripe
  about 3%. Prices can differ per platform; store rules forbid steering
  in-app users to cheaper web prices.
- **Expo Go can't test purchases.** Use the development build from RC-1.1.
