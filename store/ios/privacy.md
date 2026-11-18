# App Privacy answers (draft for Tim's review)

Answers must match what the shipped build and its backend do. Sources: `lib/analytics.ts`, `lib/votes.ts`, `api/_lib/votes.js`, `app/privacy.tsx`, RevenueCat SDK behavior.

## Privacy policy: Tim said yes (2026-11-18)

`app/privacy.tsx` said the app "does not use any analytics, tracking pixels, or third-party SDKs". That is false: events go to PostHog (`https://us.i.posthog.com`), the iOS build adds RevenueCat, and the vote API stores coarse location. Tim approved updating the policy to disclose PostHog and RevenueCat, with **no analytics on the Kids & Family pages and kids-tagged questions**. The growth session makes the `privacy.tsx` change (PR #85) using the text below; this kit's answers must stay consistent with it.

Proposed policy text:

> **Analytics.** We use PostHog to understand which screens and categories are used, for example when a category is opened or a paywall is viewed. Events are linked to a random anonymous ID created on your device. We do not collect your name, email address or precise location, and we do not use the data for advertising or sell it. We do not run analytics on the Kids & Family pages or on questions tagged for kids.
>
> **Votes.** When you answer a question we store the question, your choice, the time, your anonymous ID and a coarse location (country and region, derived by our host from your connection; we do not store your IP address). For Kids & Family questions we store neither the anonymous ID nor location.
>
> **Purchases.** In-app purchases are processed by Apple. We use RevenueCat to validate and restore purchases. RevenueCat receives an anonymous app user ID and your purchase history for this app, not your name or Apple ID.

## App Privacy ("nutrition label") draft

Data is collected, none is used for tracking, none is linked to a real-world identity. "Linked to the user" means linked to the anonymous ID.

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Purchases (purchase history) | Yes (RevenueCat) | Yes (anonymous app user ID) | No | App functionality |
| Identifiers: User ID / Device ID (random anonymous ID) | Yes | Yes | No | Analytics, app functionality (one vote per question) |
| Usage data: Product interaction (PostHog events, votes) | Yes | Yes | No | Analytics, app functionality |
| Location: **Coarse Location** (country and region stored with each non-kids vote, from the host's geo headers) | Yes | Yes (stored with the player id) | No | Analytics (aggregate vote results by region) |
| Diagnostics | No (no crash SDK) | n/a | n/a | n/a |
| Contact info, precise location, contacts, photos, health, financial info, browsing and search history, user content | No | n/a | n/a | n/a |

Notes:
- Coarse Location was missing from the first draft. `geoFromHeaders` in `api/_lib/votes.js` reads Vercel's country and region headers (never the IP) and `recordVote` stores them with `player_id` for non-kids votes. Kids votes store `player_id` null and no location.
- Backend storage counts as collection, not only SDKs: re-run this table whenever an API route starts storing a new field.
- Kids & Family: no analytics events and no player id or location are collected there. If the growth PR (#85) ships the Kids exclusion differently, update these rows to match before submitting.
- No App Tracking Transparency prompt is needed while data is not combined with third-party data for advertising and `NSUserTrackingUsageDescription` is not added.

## Other submission answers
- Encryption: standard HTTPS only; `ITSAppUsesNonExemptEncryption=false` is set in `app.json` (Unit 2 PR).
- Content rights: all questions are original to the project.
- Sign in with Apple: not required (no third-party sign-in).
- Account deletion: not applicable (no accounts).
- Advertising identifier (IDFA): not used.
- Apple Kids Category: not selected (adult themes in some questions; see `listing.md`).
