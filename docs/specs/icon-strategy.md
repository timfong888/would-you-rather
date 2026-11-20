# App icon strategy: standing out among "Would You Rather" apps

Status: research, competitor audit, 3 directions and one round of candidates, for Tim to pick. Date: 2026-11-20. No app code changed.
Supersedes the concept list in `app-icon-brief.md` (PR #110). Its hard requirements (1024x1024, opaque, square, no text, 60 px test) still apply.
Why this exists: Tim, 2026-11-19, after the first 9 candidates on #108: "it needs to be different, stand out, and look professional ... some of these other apps look bad in a very generic way ... make it look a little bit more fun ... color, brightness, distinctiveness ... it doesn't have too much detail."

## 1. Summary

- **The first round fell flat for a measurable reason: concept A (indigo/pink split + "?") is the category default.** The #1 "would you rather" app in US search (What Would You Choose? Rather, 209,817 ratings) is a blue/red split with a "?". So are #2 and #3, with "OR" in place of the "?". We had drawn the market leader's icon in our own colours.
- **Clichés to avoid:** red-vs-blue split halves (4 of the top 6), "?" glyphs (3 of 18), the words "OR" / "THIS OR THAT" / the app name as the icon (12 of 18 use words), dark purple or maroon "adult" palettes, lips, emoji faces.
- **Unowned space:** a character with a face (no "would you rather" app has one; the closest, Guess Their Answer, has 65,723 ratings), warm sunny yellow as the dominant colour, mint/teal, and an object metaphor instead of letters.
- **Recommendation: Direction A, "Hmm" mascot**: one indigo character with a raised eyebrow on sunshine yellow. Second choice: B, seesaw on mint.
- **Highest-leverage next step:** don't settle the winner by opinion alone. Ship two icons in the binary and run Apple's product page optimization test after launch (section 6).

## 2. What research says makes an icon win

| # | Finding | Source |
|---|---|---|
| R1 | Icons appear on the Home Screen and in search results, notifications, Settings and share sheets; the job is recognition at a glance. | [Apple HIG, App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) |
| R2 | "Embrace simplicity... Find a concept or element that captures the essence" of the app; fine detail looks busy and is hard to make out at small sizes. | Apple HIG |
| R3 | "Include text only when it's essential"; text is too small to read, doesn't localize, and the app name already sits next to the icon. | Apple HIG |
| R4 | Prefer illustration to photos; don't add your own shadows, bevels, glows or highlights (the system adds Liquid Glass effects). | Apple HIG |
| R5 | iOS 26 icons are layered (background + foreground) and get Liquid Glass highlights. A flat PNG is auto-segmented, and only **large, simple shapes** get the glass effect; text and thin lines don't. | Apple HIG; [Icon Composer](https://developer.apple.com/icon-composer/) |
| R6 | Users can pick default, dark, clear or tinted Home Screen icons. Keep core features the same across all of them; dark/tinted are more muted; colour backgrounds give the most contrast in dark mode. | Apple HIG |
| R7 | Avoid black backgrounds; keep a safe zone; supply a square, unmasked image (iOS rounds the corners). | Apple HIG |
| R8 | Consider filled, overlapping shapes for depth. | Apple HIG |
| R9 | Icon A/B tests commonly move conversion 5 to 20%: Spin the Bottle +19.4% (20.46% → 24.42%), Darby Smart +10% with the "clearest and most accurate representation", MyTona +9.1%. Vendor-published, selected for success. | [SplitMetrics: Ciliz](https://splitmetrics.com/cases/ciliz-improves-conversion-with-splitmetrics-agency/), [Darby Smart](https://splitmetrics.com/blog/relying-on-trends-or-creating-an-easy-to-understand-icon-find-out-which-is-better/), [MyTona](https://splitmetrics.com/cases/mytona-app-icons-halloween-update) |
| R10 | SplitMetrics benchmark (about 200 apps, 3,500+ tests): clear, simple icon backgrounds beat cluttered ones by over 26%. **Not verified** against the original report. | [PocketGamer.biz summary](https://www.pocketgamer.biz/research-finds-that-app-icon-optimization-can-boost-user-numbers-by-up-to-25) |
| R11 | Third-party tests: Bible Companion +11.4% (97.5% confidence); FoodNoms +9.99% (only 81.7% confidence). | [FoodNoms](https://foodnoms.com/blog/new-foodnoms-app-icon); Bible Companion via Admiral Media (**not verified**) |
| R12 | StoreMaven claims up to 30% lift from icon optimization. **Not verified**: no published method found. | Third-party write-ups only |
| R13 | Apple's product page optimization tests up to 3 alternate icons against the original. Alternates must already be in the live binary, 1024x1024. Results use Bayesian analysis; Apple suggests waiting for 90% confidence. | [Apple: Product page optimization](https://developer.apple.com/app-store/product-page-optimization/), [ASC Help](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization) |

What this means for us: one large focal shape, no letters, a bright solid or gradient background (not black), no fake shine, and a shape that still reads as a silhouette when iOS turns it monochrome (tinted) or dims it (dark). Distinctiveness comes from being different from the icons next to it in search, not from more detail.

**Not verified:** a specific study on saturation or brightness vs. conversion. "Bright and high-contrast wins" is common practitioner advice. I found no controlled study and don't claim one.

## 3. Competitor audit

Method: iTunes Search API, US store, 2026-11-20, terms "would you rather", "this or that", "party game questions", "conversation starters", "truth or dare". This sandbox's proxy blocks `itunes.apple.com` and Apple's image CDN, so I ran the query and downloaded `artworkUrl512` in Composio's remote sandbox. Motifs come from a vision model (Gemini 2.5 Flash via fal/OpenRouter) reading a contact sheet. Colours come from k-means on the pixels. **I could not view the icons with my own eyes**; motif labels are machine-read and may be wrong in detail. Mobbin was not used: it has app UI screens, not App Store icon listings.

Contact sheet (18 icons, 160 px): https://backend.composio.dev/api/v3/sl/EHgLKd8Rbh (temporary Composio link)

| # | App | Rating (count) | Motif | Text in icon | Dominant colours |
|---|---|---|---|---|---|
| 1 | What Would You Choose? Rather | 4.59 (209,817) | **Split halves + "?"** in a circle | ? | sky blue `#52BEF6`, red `#F53531`, black |
| 2 | Would You Rather? Adult | 4.57 (20,222) | **Split + "OR"** in a circle | OR | light blue `#94DAEF`, grey, red `#FA4F50` |
| 3 | Either - You Would Rather?! | 4.43 (59,386) | **Split + "OR"** in a circle | OR | blue `#398AFB`, red `#FE3B3C`, grey |
| 4 | Would You Rather? Dirty Adult | 4.60 (7,738) | Quote mark, blank line | "Would you _" | deep purple `#3D0D8A` |
| 5 | Would You Rather: Adult Games | 4.47 (470) | Stacked bubble letters | WOULD YOU RATHER | dark purple `#2A1D3E`, pink, cyan |
| 6 | Would You Rather: Party Games | 4.73 (250) | Winking emoji face on split bg | none | red `#B02510`, blue `#06B1F9`, yellow |
| 7 | Would You Rather? Group Game | 4.59 (93) | Lips biting | none | yellow `#F5C75E`, dark red |
| 8 | Rather Dirty - For Adults | 4.27 (6,159) | "?" in a circle | ? | red `#D30707`, white |
| 9 | Would you rather: Dirty | 4.45 (164) | Gold "?", chain, 18+ tag | 18+ | maroon `#89033C`, gold |
| 10 | This Or That? - Questions Game | 4.63 (537) | Split panel | THIS OR THAT | red `#B42122`, green `#92CD1A` |
| 11 | This or That.. | 4.73 (3,412) | Slanted split panel | This Or That | purple `#8B3F7E`, green `#80B92F` |
| 12 | Exposed - Who's Most Likely To | 4.64 (236,984) | 3D letters | EX | neon green `#01F901`, white |
| 13 | Truth Or Dare : Party Game | 4.63 (44,177) | Script lettering | Truth Or Dare | coral `#FD5243`, pink `#FA375F` |
| 14 | Guess Their Answer | 4.66 (65,723) | **Two characters** with score buttons | THIS 4 / THAT 0 | blue `#2295F8`, yellow `#F1D266` |
| 15 | Party Up: Friends & Group Game | 4.70 (3,809) | Glitch lettering | PARTY UP | navy `#202157`, white |
| 16 | 21 Questions - Card Games | 4.68 (9,385) | Two cards | 21Q | violet `#4911FC`, `#7146FC` |
| 17 | Party Qs - Questions App | 4.75 (336) | Big letter | Qs | charcoal `#444444`, white |
| 18 | How Well Do You Know Me? | 4.72 (25,300) | Stacked text on rainbow | DO YOU KNOW ME? | mint `#ACEA9C`, magenta, black |

### Motif and colour grid

| Motif | Apps | Share |
|---|---|---|
| Two-colour split halves | 1, 2, 3, 6, 10, 11 | 6/18 (4 of the top 6 "would you rather") |
| Words or letters as the icon | 2, 3, 4, 5, 10, 11, 12, 13, 15, 16, 17, 18 | 12/18 |
| "?" glyph | 1, 8, 9 | 3/18 |
| "OR" | 2, 3, 10, 11 | 4/18 |
| Adult signals (dark purple/maroon, lips, 18+) | 4, 5, 7, 9 | 4/18 |
| Character or face | 6 (emoji), 14 | 2/18, none a "would you rather" mascot |
| Speech bubbles | none in this sample (common in chat apps) | 0/18 |

| Colour family | Apps |
|---|---|
| Red + blue | 1, 2, 3, 6 (plus 14 blue/yellow) |
| Red/coral/pink dominant | 8, 10, 13 |
| Dark purple/maroon/navy | 4, 5, 9, 15, 16 |
| Green | 10, 11, 12, 18 |
| Warm yellow dominant | 7 (adult lips) only |
| Teal/mint dominant | 18 only (behind text) |

### Clichés to avoid
1. Red-vs-blue (or indigo-vs-pink) split halves. This is the first-round concept A, and our in-app A/B colours put us right on top of the leader.
2. "?" and "OR" glyphs.
3. Words as the icon (the name already shows under the icon, R3).
4. Dark purple/maroon or lips: these read as "adult", the opposite of "Family Fun".
5. Emoji-style yellow circle faces (#6), and Apple's own emoji artwork must not be used anyway.

### White space nobody owns
- **A mascot with a face**, built from simple shapes. Character icons are rare here, and the one character icon in the set (#14) is a top-3 app by ratings.
- **Sunshine yellow or mint as the main background.** Bright, family-friendly, and distinct from the sea of red/blue/purple.
- **An object metaphor for "choose"** (seesaw, pair of things) instead of letters.

## 4. Three directions

All share: no text, no glyphs, opaque, square, one focal shape filling 60 to 70% of the frame inside the safe zone, flat colour (the system adds glass), brand indigo `#5C54E8` and pink `#E8316A` kept as **accents**, not as split halves.

### A. "Hmm" mascot (recommended)
- **Idea:** one chunky indigo blob character, big white eyes glancing sideways, one eyebrow raised: the face you make while deciding. A small pink cheek.
- **Why against the audit:** the only face-based icon idea in the niche that isn't an emoji or lips; yellow background is unowned; no split, no "?", no words. It also becomes the brand's character for splash, screenshots and share cards.
- **Palette:** background sunshine yellow `#FFC93C` (optional light centre `#FFD966`), body indigo `#5C54E8`, eyes `#FFFFFF`, pupils and brow `#1A1A2E`, cheek `#E8316A`.
- **Shape:** one rounded blob, about 60% of the frame, centred slightly low.
- **60 px:** a dark blob on bright yellow is the strongest silhouette of the three; the two white eyes stay visible down to 29 px.
- **Dark / tinted:** dark mode: keep the yellow muted (`#D9A520`) or use indigo-on-dark-indigo with yellow eyes. Tinted: monochrome blob plus eye holes still reads as a face. Build as 2 layers (yellow background; blob + eyes foreground).
- **Risks:** AI output is cute but not yet "designed"; needs a vector redraw for consistent line weight. Can look like a kids-only app; the 13+ rating and adult categories may feel mismatched (Tim chose "Family Fun", so acceptable).
- **fal prompt (as run, `fal-ai/flux-2-pro`, `square_hd`, seeds 11 to 14):**
  `Flat vector app icon, square 1:1, full-bleed. Solid warm sunshine-yellow background #FFC93C with a very subtle lighter glow at the centre. One chunky friendly cartoon character centred, filling about 60% of the frame: a soft rounded indigo #5C54E8 blob with two big white oval eyes glancing to the right with small dark pupils, one thick dark eyebrow raised high in a playful 'hmm, which one?' look, one small pink #E8316A cheek. No mouth or a tiny sideways smirk. Bold simple shapes, thick clean silhouette, flat colour, no outline strokes, no text, no letters, no numbers, no question marks, no symbols, no border, no frame, no rounded corners on the canvas, no drop shadow, no 3D, fully opaque, high contrast, professional, reads clearly at 60 pixels.`

### B. Seesaw
- **Idea:** a white playground seesaw tipped one way: indigo ball up, pink ball down. "Weighing two options", and a playground says fun and family.
- **Why against the audit:** keeps both brand colours as the two choices without the split-background cliché; mint is unowned.
- **Palette:** background mint `#4ECDC4` (brand accent; deeper `#2FB8AE` for gradient), plank `#FFFFFF`, balls `#5C54E8` and `#E8316A`.
- **Shape:** plank + triangle + two balls; about 70% of the width.
- **60 px:** reads, but the plank must be thick (8% of icon height or more) or it disappears.
- **Dark / tinted:** dark: mint to `#1F8F88`. Tinted: the two balls become the same tone and the "two choices" meaning weakens; the shape survives.
- **Risks:** abstract; could read as a physics or balance app. Tidier than A, less personality.
- **fal prompt (as run, seeds 11 to 14):**
  `Flat vector app icon, square 1:1, full-bleed. Solid mint-teal background #4ECDC4. Centred: a simple playground seesaw, a thick white rounded plank balanced on a small white triangle, tilted about 15 degrees. One large solid indigo #5C54E8 ball sits on the raised left end and one large solid pink #E8316A ball on the lowered right end. Only these elements, large and centred, filling about 70% of the width.` + the same tail as A.

### C. Two cherries
- **Idea:** two cherries on one forked stem, one indigo, one pink: two options from one question. Fruit reads as friendly.
- **Why against the audit:** a light background stands out against the mostly dark competitor icons; an object, not letters.
- **Palette:** background warm cream `#FFF4E0`, cherries `#5C54E8` and `#E8316A`, stem/leaf `#2D9E6B`, highlight `#FFFFFF`.
- **Shape:** two circles + stem, about 65% of the frame.
- **60 px:** reads well (two big circles).
- **Dark / tinted:** a cream background goes muddy in dark mode; use dark indigo `#1E1E32` behind the cherries. Tinted is fine.
- **Risks:** the strongest association for cherries is slot machines and fruit apps; a pair can mean "both" rather than "either". A light background can wash out on light wallpapers.
- **fal prompt (as run, seeds 11 to 14):**
  `Flat vector app icon, square 1:1, full-bleed. Solid warm cream background #FFF4E0. Centred: two large round cherries hanging from one forked green #2D9E6B stem with a single small leaf; the left cherry solid indigo #5C54E8, the right cherry solid pink #E8316A, each with one small white highlight dot. The cherries fill about 65% of the frame.` + the same tail as A.

### Recommendation
**A, "Hmm" mascot.** It is the only direction that is clearly different from every competitor in search *and* adds personality; it has the strongest 60 px silhouette and survives tinted mode as a face. B is the safer, more corporate option. C's slot-machine association is a real risk for an app with purchases.

## 5. Candidate round (2026-11-20)

- Model `fal-ai/flux-2-pro` (fal lists a commercial licence), via Composio `fal_ai` (account `fal_ai_neti-veri`), 1024x1024 PNG, 4 seeds per direction.
- **Spend: about $0.39.** 12 images x 1.05 MP x $0.03/MP (`FAL_AI_GET_PRICING`) = $0.38, plus 4 vision-model review calls = $0.009 (fal-reported cost). Not checked against the fal billing page.
- **Post-processing:** all 12 came back RGB with no alpha, but flux drew **pre-rounded corners on a white canvas** (corner pixels white). I flood-filled the corners with each icon's background colour. The "fixed" set is opaque, square and 1024x1024. Any final icon still gets a vector redraw.
- **Review:** this sandbox cannot download from `v3b.fal.media` or the Composio file host, so **I did not look at the images myself.** Checks done: pixel tests (alpha, corners) and two vision-model passes. These found no text or stray letters in any candidate and said all read at 60 px. They also flagged that the A blob touches the top edge in A12 and A13. The vision model ranked C12, B12 and A11 best, which is not my recommendation; I weight distinctiveness against the audit above its taste.

Raw fal output:
- A: [A11](https://v3b.fal.media/files/b/0ab32a09/Y4mAuTiwEpvI9_qYv0gm2_9z0B5FfU.png) [A12](https://v3b.fal.media/files/b/0ab32a09/8kHFqgEAq7wub37oZ_HuQ_njHVNKXY.png) [A13](https://v3b.fal.media/files/b/0ab32a09/1Ts_CmYGrVq8AilhWlZbK_O2mDhZnN.png) [A14](https://v3b.fal.media/files/b/0ab32a09/gfqIlCQsd_cC_n4BQdDMQ_v6zHlnJ6.png)
- B: [B11](https://v3b.fal.media/files/b/0ab32a09/k3gGhaP1vXSCqktJVGtiq_5TD7DPiC.png) [B12](https://v3b.fal.media/files/b/0ab32a09/m1a-p3cokW7ySL6Ys2Pyk_3ScGoozJ.png) [B13](https://v3b.fal.media/files/b/0ab32a0a/UTuWaFaj5IGIwpAC6sQbo_5hN107XI.png) [B14](https://v3b.fal.media/files/b/0ab32a0a/heWu24z0m0LmWlpgHpyDH_Eyrg8iQ8.png)
- C: [C11](https://v3b.fal.media/files/b/0ab32a0a/Qvr6cxKBIOSMhFkKQrVD-_EJ1xtV8x.png) [C12](https://v3b.fal.media/files/b/0ab32a0a/LaRek1ncs291-k9HOwzgr_Q5lluZz9.png) [C13](https://v3b.fal.media/files/b/0ab32a0a/IDZhwUcsT7EAcFnyerpzm_t8qrmXN1.png) [C14](https://v3b.fal.media/files/b/0ab32a0a/ipaUcIASoS3hVQjOV6d42_I4Tu6XSr.png)

Corner-fixed set and contact sheet (each candidate at 200 px and 60 px), temporary Composio links:
- Contact sheet: https://backend.composio.dev/api/v3/sl/8Fmgen_Lfw
- 12 fixed PNGs (zip): https://backend.composio.dev/api/v3/sl/5KMYiDghmZ

fal and Composio links may expire. Tell me the winner and I will store it in the repo.

## 6. Next steps and blind spots

1. **Tim picks a direction** (and a seed if one is close). Then: redraw as vector (SVG) or run a second, tighter AI round on that direction only, then dark and tinted variants, then a 2-layer Icon Composer file, then a new build.
2. **Test, don't guess (highest leverage).** Put the winner and the runner-up (for example A and B) in the binary as alternate icons. After launch, run an App Store product page optimization test (R13). A 10 to 20% conversion swing (R9) matters more than any opinion here, including mine.
3. **Look in context before deciding:** put the 60 px versions in a mock App Store search results row next to icons 1 to 3 above, and on light and dark wallpapers.
4. **Blind spot: brand fit.** Direction A moves the brand from "indigo vs pink" to "indigo character on yellow". Screenshots and the splash should follow, or the icon and the first screen won't match (the reason concept A was originally chosen).
5. **Blind spot: audience.** A cute mascot pulls toward kids. The listing is 13+ with adult categories. If teens and couples are the real buyers, B is the safer pick.
