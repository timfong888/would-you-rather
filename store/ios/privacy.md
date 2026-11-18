# App Privacy answers (draft for Tim's review)

Answers must match what the shipped build does. Source of facts: `lib/analytics.ts`, `lib/votes.ts`, `app/privacy.tsx`, RevenueCat SDK behavior.

## BLOCKER: the in-app privacy policy is inaccurate

`app/privacy.tsx` says the app "does not use any analytics, tracking pixels, or third-party SDKs that collect user data". That is false: the app sends events to PostHog (`https://us.i.posthog.com`) and the iOS build adds RevenueCat. Apple requires the privacy policy URL, the privacy label and the app's real behavior to agree. The policy page (which is also live on the website) needs a rewrite before submission. Proposed replacement text for the Analytics and Purchases sections:

> **Analytics.** We use PostHog to understand which questions and screens are used, for example when a category is opened or a paywall is viewed. Events are linked to a random anonymous ID created on your device. We do not collect your name, email address or precise location, and we do not use the data for advertising or sell it.
>
> **Purchases.** In-app purchases are processed by Apple. We use RevenueCat to validate purchases and to restore them. RevenueCat receives an anonymous app user ID and your purchase history for this app, not your name or Apple ID.

This changes live legal text, so it is not edited in this PR. Tim approves wording.

## App Privacy ("nutrition label") draft

Data is collected, none is used for tracking, none is linked to a real-world identity.

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Purchases (purchase history) | Yes (RevenueCat) | Yes (anonymous app user ID) | No | App functionality |
| Identifiers: Device ID / User ID | Yes (random anonymous ID) | Yes | No | Analytics, app functionality (one vote per question) |
| Usage data: Product interaction | Yes (PostHog events, votes) | Yes (anonymous ID) | No | Analytics, app functionality |
| Diagnostics | No (no crash SDK) | n/a | n/a | n/a |
| Contact info, location, contacts, photos, health, financial info, browsing history, search history, user content | No | n/a | n/a | n/a |

Notes:
- "Linked to user" is Yes because the anonymous ID persists across events. Apple's definition does not require a real name.
- No App Tracking Transparency prompt is needed as long as the data is not combined with third-party data for advertising and `NSUserTrackingUsageDescription` is not added.
- Votes store the choice, time and anonymous ID; the policy says IP addresses are not stored.

## Other submission answers
- Encryption: standard HTTPS only; `ITSAppUsesNonExemptEncryption=false` is set in `app.json` (PR for Unit 2).
- Content rights: all questions are original to the project.
- Sign in with Apple: not required (no third-party sign-in).
- Account deletion: not applicable (no accounts).
- Advertising identifier (IDFA): not used.
