# iOS store listing kit

Everything App Store Connect needs, for Tim to review. **Nothing has been uploaded.**

| File | What |
|---|---|
| `screenshots/<device>/NN-name.png` | 6 screenshots each for iPhone 6.9" (1320x2868), iPhone 6.5" (1284x2778) and iPad 13" (2064x2752). Regenerate: `scripts/store/screenshots.mjs` |
| `listing.md` | name, subtitle, description, keywords, URLs, category, age-rating draft, review notes |
| `privacy.md` | App Privacy answers, and a **blocker**: the in-app privacy policy says there is no analytics or third-party SDK, which is false |
| `iap.md` | the 10 in-app products and prices |

Open items before submission:
1. Privacy policy rewrite (blocker, `privacy.md`).
2. IAP review screenshots need a native build (Unit 2 blocked on the Expo token).
3. iPad: `supportsTablet` is true, so iPad screenshots are required, but the layout stretches a phone column across the screen (see `ipad-13/*`). Options: ship iPhone-only for v1 (`supportsTablet: false`, no iPad screenshots), or give iPad a real layout.
4. Screenshots are the web render, not simulator captures (header chrome differs from native).
5. Name availability, support page contact, age-rating answers, copyright holder.
