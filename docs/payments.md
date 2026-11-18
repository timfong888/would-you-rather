# Payments (RevenueCat)

Status: iOS code complete, sandbox-tested against the RevenueCat **Test Store** catalog.
Device purchase tests need an EAS development build (Unit 2, issue #75).

## Product model (Tim, issue #54, 2026-11-18)

| Product | Store id | Entitlement | Price |
|---|---|---|---|
| All categories | `wyr_premium_all` | `premium_all` | $4.99 |
| One category (x9) | `wyr_unlock_<category_id with _>` | `cat_<category-id>` | $1.99 |

A category is open if `premium_all` OR `cat_<id>` is active (`lib/catalog.ts`,
`isCategoryEntitled`). Access is by entitlement, so questions added later are
included. Nine categories have something to sell; `kids-family` is free and has
no product. The catalog is derived from `constants/questions.ts`.

One RevenueCat offering, `default`, holds one package per product (package
id = entitlement id).

## Files

- `lib/catalog.ts` ids, prices, access rule. Pure; unit-tested.
- `lib/purchases.native.ts` iOS/Android, `react-native-purchases`.
- `lib/purchases.ts` web: unavailable. Metro picks `.native.ts` on devices, so the web bundle never contains the SDK (checked with `expo export`).
- `contexts/UnlockedContext.tsx` entitlements from RevenueCat on launch, a customer-info listener, and a refresh on every app foreground (RevenueCat does not push backend changes, so a refund or expiry shows up on the next foreground).
- `app/unlock/[id].tsx` real purchase, "unlock every category", Restore Purchases, quiet user-cancel. On web the old simulated sheet is unchanged (decision pending in #53).
- `scripts/revenuecat/sync-catalog.ts` (`npm run rc:sync`) idempotent Test Store catalog sync.

## Keys

| Stage | `EXPO_PUBLIC_RC_IOS_KEY` | Purchases |
|---|---|---|
| development | `test_...` (Test Store, public) | simulated, no money |
| preview | `appl_...` | App Store sandbox |
| production | `appl_...` | real |

Set per EAS profile, never in the repo. The app is inert without the key
(`purchases.isAvailable()` is false), which is also the web behavior.
Owner-code field: leave `EXPO_PUBLIC_OWNER_ACCESS_SHA256` unset in the iOS
production profile; grant yourself access with a RevenueCat promotional
entitlement.

## Sandbox test plan

Legend: AUTO = already run by an agent against the Test Store; DEVICE = needs a dev build or TestFlight and a sandbox Apple ID.

| # | Check | How | Result |
|---|---|---|---|
| 1 | Catalog sync is idempotent | `npm run rc:sync` twice | AUTO: pass (second run created 0 objects) |
| 2 | Offering as the SDK sees it | `GET /v1/subscribers/<id>/offerings` with the `test_` key | AUTO: pass (`default` current, 10 packages with the right product ids) |
| 3 | Entitlement lookup | grant `cat_high-life` to a user, read subscriber with the SDK key | AUTO: pass |
| 4 | Gating rule | `npm test` (`tests/unit/catalog.test.ts`) | AUTO: pass |
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
| 15 | Same on App Store sandbox | `preview` build via TestFlight, `appl_` key, sandbox Apple ID | DEVICE, after #75 and store products exist |

Check each result in the RevenueCat customer view.

## Where Tim's approvals sit

1. Prices (done 2026-11-18: $4.99 / $1.99).
2. Screenshots and listing text (Unit 3 PR).
3. Go-live: real-money products, production keys, App Review submission. Not done by agents.

## Superseded

PR #44 (single `premium_pack` entitlement) and the nine-product model in
PR #62's runbook. The phases in #62 that remain valid: EAS setup, store
connection, store product creation, sandbox acceptance, go-live.
