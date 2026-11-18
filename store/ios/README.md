# iOS store listing kit

Everything App Store Connect needs, for Tim to review. **Nothing has been uploaded.**

iOS v1 scope (Tim, 2026-11-18): **iPhone only**, and **Midnight Secrets and Deep Desires are left out** (hidden on iOS, no products). The kit describes the 8 categories that ship.

| File | What |
|---|---|
| `screenshots/<device>/NN-name.png` | 6 screenshots each for iPhone 6.9" (1320x2868) and iPhone 6.5" (1284x2778), generated with the iOS v1 catalog. Regenerate: `scripts/store/screenshots.mjs` |
| `listing.md` | name, subtitle, description, keywords, URLs, category, age-rating audit and expected rating (13+), review notes |
| `privacy.md` | App Privacy answers (incl. Coarse Location) and the privacy-policy text Tim approved updating |
| `iap.md` | the 8 in-app products and prices |

Open items before submission:
1. Privacy policy page update and the kids/family analytics exclusion (PR #85, growth session) must match `privacy.md`, and the parental gate (PR #83) must be merged: the review notes describe both, and neither is in this PR.
2. IAP review screenshots need a native build (Unit 2 blocked on the Expo token).
3. Screenshots are the web render, not simulator captures (header chrome differs from native).
4. Name availability, support page contact, copyright holder.
5. The 13+ rating is an expectation from the audit; Apple computes the final rating from the questionnaire.
