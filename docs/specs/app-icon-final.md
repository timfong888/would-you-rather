# App icon (interim): "Hmm" mascot, candidate A11

Status: interim, per Tim 2026-11-20 ("Start with A for the mascot, revisit later"). Tracked on #114 and #108.

- **Source:** fal `fal-ai/flux-2-pro` via Composio, seed 11, direction A of `icon-strategy.md`.
- **Why A11 of A11 to A14:** simplest silhouette (one blob, one face), the eyes and raised brow still read at 29 px, strongest contrast of blue on amber. A12 is a close second (brighter blue). A13 is darker and lower contrast. A14 has arms and a ground shadow that turn to mush at 60 px.
- **Post-processing:** flux drew pre-rounded corners on white. The corners were flood-filled with the background colour and a 3 px border ring was overwritten. Result: 1024x1024 RGB PNG, no alpha, square corners (iOS applies its own mask).
- **Files:** `assets/images/icon.png` (iOS, `app.json` `icon`), `assets/images/adaptive-icon.png` (same opaque image, mascot sits inside Android's safe zone), `assets/images/favicon.png` (48 px), `public/apple-touch-icon.png` (180 px).
- **Added in #174:** `assets/images/icon-dark.png` (indigo gradient background, eyebrows lightened so they stay visible) and `assets/images/icon-tinted.png` (greyscale on black), wired as `ios.icon` `{ light, dark, tinted }` in `app.json`; `assets/images/splash.png` is now the mascot on a transparent 1024x1024 canvas over the `#0F0F1A` splash background. `expo prebuild` on Expo 54 generates all three icon files.
- **Not done:** how the dark and tinted icons and the splash look on a device (needs a TestFlight build), vector redraw, and the A/B/C direction decision (Tim). Revisit before submission.
