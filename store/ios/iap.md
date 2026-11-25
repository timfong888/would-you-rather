# In-app products (draft for Tim's review)

Created in App Store Connect by hand, or by the **Apple IAP create** workflow (`.github/workflows/apple-iap-create.yml`, input `store/ios/iap-products.json`): dry run by default, writes only with `apply=true` and `confirm=CREATE-9-IAPS`, run only with Tim's go. Either way this is the approval step for prices. As of 2026-11-25 the first 8 exist in App Store Connect (never approved, `READY_TO_SUBMIT`); the 9 kids and teen products below do not (#252, D22 #255). The create workflow skips ids that exist, so the dry run shows 8 SKIP and 9 WOULD CREATE. Prices are the ones Tim approved on 2026-11-18. Product ids match `lib/catalog.ts` and the RevenueCat Test Store catalog exactly.

All 17 are **Non-Consumable**: the pack and one product per paid category (D22, #255: no tranches, one purchase opens every question after the free 5), 7 grown-up and 9 kids and teen. Price tier: USD $4.99 for the pack, USD $1.99 for each category. Localization: English (US). Family Sharing: off (decide).

| # | Product ID | Reference name | Display name (max 30) | Description (max 45) | Price |
|---|---|---|---|---|---|
| 1 | `wyr_premium_all` | All Categories | All Grown-up Categories | All grown-up categories, plus future ones | $4.99 |
| 2 | `wyr_unlock_high_life` | Unlock The High Life | The High Life | Unlock all of The High Life | $1.99 |
| 3 | `wyr_unlock_moral_compass` | Unlock Moral Compass | Moral Compass | Unlock all of Moral Compass | $1.99 |
| 4 | `wyr_unlock_social_blunders` | Unlock Social Blunders | Social Blunders | Unlock all of Social Blunders | $1.99 |
| 5 | `wyr_unlock_time_traveler` | Unlock Time Traveler | Time Traveler | Unlock all of Time Traveler | $1.99 |
| 6 | `wyr_unlock_career_climber` | Unlock Career Climber | Career Climber | Unlock all of Career Climber | $1.99 |
| 7 | `wyr_unlock_tech_dystopia` | Unlock Tech Dystopia | Tech Dystopia | Unlock all of Tech Dystopia | $1.99 |
| 8 | `wyr_unlock_wildest_dreams` | Unlock Wildest Dreams | Wildest Dreams | Unlock all of Wildest Dreams | $1.99 |
| 9 | `wyr_unlock_tiny_choices` | Unlock Tiny Choices | Tiny Choices | Unlock all of Tiny Choices | $1.99 |
| 10 | `wyr_unlock_make_believe` | Unlock Make-Believe | Make-Believe | Unlock all of Make-Believe | $1.99 |
| 11 | `wyr_unlock_giggle_factory` | Unlock Giggle Factory | Giggle Factory | Unlock all of Giggle Factory | $1.99 |
| 12 | `wyr_unlock_road_trip_rally` | Unlock Road Trip Rally | Road Trip Rally | Unlock all of Road Trip Rally | $1.99 |
| 13 | `wyr_unlock_dinner_table` | Unlock Dinner Table | Dinner Table | Unlock all of Dinner Table | $1.99 |
| 14 | `wyr_unlock_heart_to_heart` | Unlock Heart to Heart | Heart to Heart | Unlock all of Heart to Heart | $1.99 |
| 15 | `wyr_unlock_future_me` | Unlock Future Me | Future Me | Unlock all of Future Me | $1.99 |
| 16 | `wyr_unlock_real_talk` | Unlock Real Talk | Real Talk | Unlock all of Real Talk | $1.99 |
| 17 | `wyr_unlock_holiday_table` | Unlock Holiday Table | Holiday Table | Unlock all of Holiday Table | $1.99 |

(`kids-family` is free and has no product. **Midnight Secrets and Deep Desires have no product**: they are left out of iOS v1 (Tim, 2026-11-18). The pack covers the 7 grown-up categories that ship, plus questions added to them later; it does not open kids or teen categories.) Kids and teen products exist in the catalog but sell nothing until F5b (`SELLABLE_YOUNG_TRANCHES`).

## Text changes after creation
The create workflow never changes a product that already exists. Text edits to existing products go through the **Apple IAP text update** workflow (`.github/workflows/apple-iap-update.yml`, `scripts/asc-iap-update.mjs`, #252): dry run by default (prints each product's text before and after; D22 #255 changes the text of the 8 existing products to "Unlock all of <category>"), writes only with `apply=true` and `confirm=UPDATE-IAP-TEXT`, run only with Tim's go. It changes the en-US name and description only (never price, availability or review state) and skips products that are in review or approved.

## Review screenshot (required per product)
Apple wants a screenshot of the purchase screen for each product, used for review only. They are in `store/ios/iap-review/<productId>.png` (1290x2796, iPhone 6.7"): each category's own paywall at $1.99, and for `wyr_premium_all` the paywall framed on "Or unlock every category · $4.99". They are rendered from the same paywall component in a browser at iPhone size (`scripts/render-iap-review-screenshots.mjs`; no free unlock, approved prices), not captured on an iPhone. If App Review asks for a device capture, replace the files with screenshots from a TestFlight build and re-run the upload with replace=true. Uploaded by the **Apple IAP review screenshots** workflow (`.github/workflows/apple-iap-review-screenshot.yml`): dry run by default, writes only with `apply=true` and `confirm=UPLOAD-IAP-SCREENSHOTS`. Never submits for review.

## Review notes (all products)
`Purchase from the paywall that appears after the free questions in a category. "Or unlock every category" buys the pack. Restore Purchases is on the same screen.`
