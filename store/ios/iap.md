# In-app products (draft for Tim's review)

Created in App Store Connect by hand, or by the **Apple IAP create** workflow (`.github/workflows/apple-iap-create.yml`, input `store/ios/iap-products.json`): dry run by default, writes only with `apply=true` and `confirm=CREATE-8-IAPS`, run only with Tim's go. Either way this is the approval step for prices. Prices are the ones Tim approved on 2026-11-18. Product ids match `lib/catalog.ts` and the RevenueCat Test Store catalog exactly.

All 8 are **Non-Consumable** (the pack plus 7 categories). Price tier: USD $4.99 for the pack, USD $1.99 for each category. Localization: English (US). Family Sharing: off (decide).

| # | Product ID | Reference name | Display name (max 30) | Description (max 45) | Price |
|---|---|---|---|---|---|
| 1 | `wyr_premium_all` | All Categories | All Categories | Every category, plus future questions | $4.99 |
| 2 | `wyr_unlock_high_life` | Unlock The High Life | The High Life | Every question in The High Life | $1.99 |
| 3 | `wyr_unlock_moral_compass` | Unlock Moral Compass | Moral Compass | Every question in Moral Compass | $1.99 |
| 4 | `wyr_unlock_social_blunders` | Unlock Social Blunders | Social Blunders | Every question in Social Blunders | $1.99 |
| 5 | `wyr_unlock_time_traveler` | Unlock Time Traveler | Time Traveler | Every question in Time Traveler | $1.99 |
| 6 | `wyr_unlock_career_climber` | Unlock Career Climber | Career Climber | Every question in Career Climber | $1.99 |
| 7 | `wyr_unlock_tech_dystopia` | Unlock Tech Dystopia | Tech Dystopia | Every question in Tech Dystopia | $1.99 |
| 8 | `wyr_unlock_wildest_dreams` | Unlock Wildest Dreams | Wildest Dreams | Every question in Wildest Dreams | $1.99 |

(`kids-family` is free and has no product. **Midnight Secrets and Deep Desires have no product**: they are left out of iOS v1 (Tim, 2026-11-18). The pack covers the 7 categories that ship, plus questions added to them later.)

## Review screenshot (required per product)
Apple wants a screenshot of the purchase screen for each product. One paywall capture per product (the category's own paywall; the pack can reuse any). These need a native build showing the real store price, so they are **pending Unit 2** (EAS dev build). The web paywall is not usable: it still shows the simulated sheet at $2.99.

## Review notes (all products)
`Purchase from the paywall that appears after the free questions in a category. "Or unlock every category" buys the pack. Restore Purchases is on the same screen.`
