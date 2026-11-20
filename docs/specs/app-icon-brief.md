# App icon brief: AI-generated candidates

Status: brief for Tim to pick from. Date: 2026-11-20. Decision basis: Tim, 2026-11-19, "it does need to be made by AI, and for that we'll need to use Composio. And use the fal service." Expands section 1 of `app-store-listing.md`, which stays the source for Apple's rules.

## What the icon must do

Say "two choices, one question" at a glance, on the home screen and in search results, next to icons with far more detail. It is the first thing a parent or a couple sees.

## Hard requirements (a candidate that fails any one is rejected)

| Rule | Value |
|---|---|
| Size and format | 1024x1024 px PNG |
| Alpha | **Opaque. No transparency at all.** Flatten onto the background colour. |
| Corners | Square. Do not pre-round (iOS masks it). |
| Text | **None.** No letters, no words. One "?" glyph is the only allowed mark, and only in concept A. |
| UI screenshots, photos, faces, logos of other apps | None |
| Small size | Must read at 60 px (home screen) and 29 px (Settings). Check by downscaling the PNG. |
| Safe area | Keep the key motif inside the central ~80%; iOS corner masking cuts the edges. |

## Palette (from `constants/theme.ts`)

Indigo `#5C54E8` (option A), pink `#E8316A` (option B), dark navy `#0F0F1A` (splash), white `#FFFFFF`, teal accent `#4ECDC4` (use sparingly, or not at all).

## Concepts

### A. Split choice (recommended)

- **Composition:** square divided by one crisp diagonal from lower-left to upper-right. Upper-left half indigo, lower-right half pink. One large white "?" centred on the seam, heavy rounded sans, about 55% of the icon height.
- **Motif:** the two in-app A/B buttons as two colour fields; the "?" is the question between them.
- **Must read at 60 px:** two big flat colour fields and one bold white glyph. No gradients finer than a soft 10% lightening toward the centre, no outlines, no shadows.
- **Risk:** looks like a generic "gradient plus ?" icon if the seam is weak. The diagonal must be sharp and the glyph very heavy.

**Prompt (A):**
`Flat vector-style app icon, square 1:1. Background split by a single sharp diagonal line from bottom-left to top-right: top-left half solid indigo #5C54E8, bottom-right half solid pink #E8316A. One large bold white question mark, heavy rounded sans-serif shape, centred on the diagonal, occupying about half the height. Minimal, geometric, flat colour, no gradients except a very subtle lightening toward the centre, no shadows, no outlines, no texture, no other text or letters, no border, no rounded corners, fully opaque background, high contrast, clean edges, readable at very small size.`

### B. Two bubbles

- **Composition:** dark navy `#0F0F1A` field. Two overlapping speech bubbles, centred, equal size: left bubble indigo, right bubble pink, overlap area white or a lighter blend. Tails point outward at the lower corners.
- **Motif:** two opinions in conversation. **No letters in the bubbles** (the A/B version in the spec is dropped because it fails the no-text rule); distinguish them by colour and position only.
- **Must read at 60 px:** two big rounded shapes, strong silhouette against navy.
- **Risk:** resembles chat and messaging apps; the least distinctive of the three.

**Prompt (B):**
`Flat vector-style app icon, square 1:1. Solid very dark navy background #0F0F1A. Two large overlapping speech bubbles centred in the frame, equal size, simple rounded rectangles with small tails: the left bubble solid indigo #5C54E8, the right bubble solid pink #E8316A, the overlap area a lighter blended tone. Bubbles are empty, with no letters, no text and no symbols inside. Minimal, geometric, flat colour, no gradients, no shadows, no outlines, no texture, no border, no rounded corners on the canvas, fully opaque, high contrast, clean edges, readable at very small size.`

### C. Fork in the road

- **Composition:** soft navy-to-indigo background. A single thick white path rises from the bottom centre and splits into two branches near the middle, curving up-left and up-right, each ending in a large dot: left dot indigo-light, right dot pink.
- **Motif:** the choice itself, pure "pick one".
- **Must read at 60 px:** one thick Y shape and two big dots; strokes at least 6% of the icon width.
- **Risk:** abstract; can read as a navigation or transit app.

**Prompt (C):**
`Flat vector-style app icon, square 1:1. Dark navy to deep indigo background, very subtle vertical gradient. One thick white rounded path rises from the bottom centre and forks into two branches that curve to the upper left and upper right, each branch ending in a large solid circle: the left circle indigo #7A74F0, the right circle pink #E8316A. Minimal, geometric, bold strokes, no text, no letters, no shadows, no outlines, no texture, no border, no rounded corners on the canvas, fully opaque, high contrast, clean edges, readable at very small size.`

## Generation plan

- **Tool:** Composio's `fal_ai` toolkit (`FAL_AI_RUN_MODEL_SYNC` or `FAL_AI_SUBSCRIBE_ASYNC_JOB`). No other provider.
- **Model:** pick from `FAL_AI_GET_MODELS` (category `text-to-image`) at run time. Prefer a model with strong prompt-following for flat graphics; confirm its output licence allows commercial app use before shipping.
- **Output:** square, 1024x1024 if the model supports it, otherwise generate larger and downscale.
- **Volume:** 4 candidates per concept (12 total), seeds recorded in the filename. Cost is a few US dollars at most; check `FAL_AI_GET_PRICING` first.
- **Post-processing (in the repo, not by AI):** flatten to RGB with no alpha (`sharp(...).flatten({ background })`), resize to exactly 1024x1024, then verify no alpha channel and no text.
- **Review checklist per candidate:** (1) 60 px downscale still reads; (2) no stray letters or artefacts; (3) corners are square, nothing pre-rounded; (4) no alpha; (5) colours match the palette; (6) distinct from competitor "Would You Rather" icons.
- **Then:** Tim picks one PNG. It goes into `assets/images/icon.png`; favicon, adaptive icon and splash are derived from it. An icon change needs a new build.

## Status of generation

Blocked until the `fal_ai` connection in Composio is authorized (see issue #108). No candidates exist yet.
