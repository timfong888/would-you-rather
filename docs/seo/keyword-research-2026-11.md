# Keyword research: personas × funnel (2026-11-17)

Source: OpenSEO (DataForSEO, US, English). Pulled 2026-11-17. Cost: about 320 credits.
Volume = average monthly US searches. KD = keyword difficulty, 0–100 (lower is easier).
Tracking issue: #63.

## Read this first: volume for "kids" queries is hidden

Every query that contains "kids" or "for kids" came back with **no volume**. That covers
"would you rather questions for kids", "funny would you rather questions for kids",
"this or that questions for kids", "road trip games for kids", "conversation starters for kids"
and others. Re-running with clickstream data didn't help either. The likely cause: Google Ads
restricts data for terms aimed at children, and these volumes come from Google Ads.

So the demand for these queries is **inferred**, not measured:

- Grade and age variants do show volume: kindergarten 720, elementary students 390,
  first graders 320, preschoolers 260, 3rd graders 260, 5-year-olds 110.
- The parent head terms are large and easy: "would you rather questions" 246,000 (KD 14),
  "funny would you rather questions" 18,100 (KD 1), "this or that questions" ~32,000 (KD 0).
- The page-1 results for the "for kids" queries are all dedicated kids' pages (see below),
  so Google treats them as a distinct intent with real demand.

**Measure it ourselves.** Two weeks after launch, Search Console impressions are the real
volume for these queries. That's the first job of the measurement step (`docs/seo-content-skill.md`).

## Persona 1: parents of young kids (this batch)

| Funnel | Keyword | Volume | KD | Notes |
|---|---|---:|---:|---|
| TOFU | would you rather questions (head) | 246,000 | 14 | Generic. The parent pages aim for long-tail variants of it. |
| TOFU | funny would you rather questions | 18,100 | 1 | The "for kids" variant has no volume (see above) |
| TOFU | this or that questions | ~32,000 | 0 | The "for kids" variant has no volume |
| TOFU | gross would you rather questions | 1,300 | 0 | Kids love gross-out questions |
| TOFU | christmas would you rather questions | 1,000 | 0 | Seasonal: peaks in December |
| TOFU | would you rather questions for kindergarten | 720 | 5 | |
| TOFU | thanksgiving would you rather questions | 590 | 0 | Seasonal: peaks in November |
| TOFU | family would you rather questions | 590 | 4 | |
| TOFU | would you rather questions for elementary students | 390 | 4 | |
| TOFU | winter would you rather questions | 390 | 0 | Next seasonal page |
| TOFU | would you rather questions for first graders | 320 | 4 | |
| TOFU | would you rather questions for preschoolers | 260 | 4 | |
| TOFU | would you rather questions for 3rd graders | 260 | 8 | |
| TOFU | would you rather questions for family | 260 | 3 | |
| TOFU | would you rather questions for kids | hidden | — | Biggest kids term by every proxy |
| MOFU | road trip games | 3,533 | 0 | The would-you-rather angle is the in-car conversation game |
| MOFU | family dinner questions | 480 | 4 | |
| MOFU | table topics family | 210 | 12 | A competitor product: people searching for a conversation card game |
| MOFU | dinner conversation starters for families | 170 | 4 | |
| MOFU | dinner table conversation starters | 90 | 3 | Existing page, retargeted to families |
| MOFU | family conversation games | 50 | 0 | CPC $0.79: commercial intent |
| BOFU | would you rather game | 9,900 | 18 | |
| BOFU | would you rather app | 6,600 | 1 | **CPC $2.80**, the highest commercial value in the set, and KD 1 |
| BOFU | would you rather game online | 1,600 | 18 | |
| BOFU | would you rather card game | 880 | 0 | People shopping for physical decks |

## Personas 2 and 3 (next batches)

| Persona | Funnel | Keyword | Volume | KD |
|---|---|---|---:|---:|
| Couples / dating | TOFU | questions to ask your partner | 22,200 | 0 |
| Couples / dating | TOFU | would you rather questions for couples | 12,100 | 0 |
| Couples / dating | TOFU | questions for couples | 12,100 | 8 |
| Couples / dating | TOFU | would you rather questions for adults | 8,100 | 0 |
| Couples / dating | TOFU | deep would you rather questions | 2,900 | 0 |
| Couples / dating | TOFU | spicy would you rather questions | 1,600 | 0 |
| Couples / dating | MOFU | date night questions | 1,300 | 0 |
| Couples / dating | TOFU | would you rather questions for boyfriend / girlfriend | 880 / 260 | 0 |
| Couples / dating | BOFU | would you rather game for couples | 590 | 0 |
| Kids/teens in groups | TOFU | would you rather questions for teenagers / teens | 5,400 | 1 |
| Kids/teens in groups | TOFU | hard would you rather questions | 9,900 | 0 |
| Kids/teens in groups | TOFU | would you rather icebreaker questions | 720 | 0 |
| Kids/teens in groups | TOFU | would you rather questions for students | 590 | 5 |
| Kids/teens in groups | TOFU | would you rather questions for friends | 480 | 5 |
| Kids/teens in groups | TOFU | questions to ask at a sleepover | 320 | 0 |

The couples and teens clusters have more *measurable* volume than the parents cluster. Parents
are first because of the proposed MVP focus in the PRD, not because their volume is proven.
Tim should know this when deciding persona order (#63).

## Who ranks now, and the gaps they leave

Live Google results (mobile, US), 2026-11-17:

| Query | Page-1 sites |
|---|---|
| would you rather questions for kids | thebestideasforkids, growingplay, tellmecards (ages 5–9), allprodad, liveboldandbloom, todaysparent |
| …for kindergarten | growingplay, mumslittleexplorers (PDF), wouldyouratherquestionsfor.com, Pinterest, parents.com |
| funny …for kids | mkewithkids, growingplay, Pinterest, pastory.app, YouTube, woulduratherquestions.com |
| …for family | lovetoknow, inclusiveteach, readbrightly, familyeducation, thefamilydinnerproject |
| family dinner questions | Pinterest, imthecheftoo, greenlight, momgenerations, gatheredagain, hellosensible |
| road trip games | hugateen, Pinterest, smalltowntravelguide, surprisinggetaways, popsugar |
| this or that questions for kids | Pinterest ×2, kokotree, Angela Lee, wyrdo, parade |
| christmas would you rather questions | boldbubbly, nicolegwen, learngrowaspire, thebfamily, kidswhoplay, psycatgames |
| would you rather app | Google Play, Reddit, Softonic, freeappsforme, Uptodown, would-you-rather-game.com |
| would you rather game | wouldyourather.app, Reddit, wouldurather.io, everythingmom, countryliving |

What this shows:

1. **Small sites rank.** Mom blogs, small publishers and Pinterest boards sit on page 1, which
   matches the KD of 0–8. A new domain can get there with better pages.
2. **Every ranking page is a static wall of text.** Lists of 80–200 questions, often with a PDF
   download. **None of them can be played, and none shows how other families answered.** That
   is our gap: a list you can play in one tap, with an answer split you can share.
3. **Few are sorted by age.** Most "for kids" lists mix questions for 4-year-olds with questions
   for 11-year-olds. Pages built for an age band (4–6, 6–10) answer what the parent actually
   searched for.
4. **Thin "how to use it" advice.** Parents want to know *when* and *how* to play (car, dinner,
   bedtime) and what follow-up question to ask. Short, specific parent tips on each page add
   value the lists don't have.
5. **The BOFU results are weak.** "would you rather app" (6,600, KD 1, $2.80 CPC) is held by app
   stores, download mirrors and a Reddit thread. A real web app with no install and no sign-up
   fits this query better than any of them.

## Clusters → pages (batch 1, parents)

One page per intent cluster. Each page gets its own hand-written question set; no question appears on two pages.

| # | Page (slug) | Primary keyword | Also covers | Funnel |
|---|---|---|---|---|
| 1 | `/would-you-rather-questions-for-kids` (existing, rebuilt) | would you rather questions for kids | kids would you rather questions, printable | TOFU hub |
| 2 | `/funny-would-you-rather-questions-for-kids` | funny would you rather questions for kids | silly, hilarious | TOFU |
| 3 | `/would-you-rather-questions-for-kindergarten` | would you rather questions for kindergarten | preschoolers, 4/5/6-year-olds | TOFU |
| 4 | `/would-you-rather-questions-for-elementary-students` | …for elementary students | first graders, 3rd graders, 7–10-year-olds | TOFU |
| 5 | `/gross-would-you-rather-questions` | gross would you rather questions | gross … for kids | TOFU |
| 6 | `/this-or-that-questions-for-kids` | this or that questions for kids | this or that for kids | TOFU |
| 7 | `/thanksgiving-would-you-rather-questions` | thanksgiving would you rather questions | …for kids, …for family | TOFU (seasonal) |
| 8 | `/christmas-would-you-rather-questions-for-kids` | christmas would you rather questions | …for kids | TOFU (seasonal) |
| 9 | `/would-you-rather-questions-for-family` | would you rather questions for family | family would you rather, family game night | TOFU/MOFU |
| 10 | `/dinner-table-conversation-starters` (existing, retargeted) | family dinner questions | dinner conversation starters for families | MOFU |
| 11 | `/road-trip-would-you-rather-questions` | road trip games (would you rather angle) | car games for kids, road trip questions | MOFU |
| 12 | `/would-you-rather-app` | would you rather app | would you rather game online, free | BOFU |

Next for parents: winter (390), animals, Easter / summer seasonals, bedtime questions.
Next batches: couples (persona 2) and teens/groups (persona 3), using the tables above.
