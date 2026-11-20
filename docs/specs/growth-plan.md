# Growth plan: SEO, outreach, referral, ASO, Android

Status: **spec only, for Tim's decisions.** No app code, store setting or live page changes here. Date: 2026-11-20.
Asked by Tim, 2026-11-19: "What is the growth plan in terms of SEO for would you rather? Build that up and see how to make it autonomous. SEO is one. Finding blogs for parents. Creating a referral link maybe although there's so little money in it is there one worth using? What about keyword optimization for the AppStore. How do we start to get onto android once we lock down the AppStore version to stable."

Read for this: the PRD (Google Doc), `docs/seo.md`, `docs/seo-content-skill.md`, `docs/seo/keyword-research-2026-11.md`, the 14 landing pages in `constants/seoPages.ts`, live `llms.txt` / `sitemap.xml`, PR #66 (SEO batch 2), PR #85 (PostHog attribution), PRs #123 / #129 (share links and cards), `docs/kids-privacy.md`, `docs/specs/app-store-listing.md`, `docs/specs/kids-family-categories.md`, `docs/specs/icon-strategy.md`. Not read: `CLAUDE.md` (not on `main`; it is in open PR #60) and global-config issue #84 (another repo, outside this session's access). `docs/seo-content-skill.md` is the in-repo draft of that skill and is what this plan builds on.

Markers: **[verified]** = checked in this session against a live source or tool. **[unverified]** = from memory or a secondary source; check before acting.

## 0. Summary

1. **SEO is the engine, and most of it can run on a weekly schedule.** A scheduled agent reads Search Console, picks the next 2–3 keywords from a scored backlog, writes pages with the existing `seo-content` process, runs the build checks plus a kids-safety and thin-content pass, and opens a PR. **It never merges.** Tim reads the kids questions and merges.
2. **Search Console is already verified** for `sc-domain:wouldyourather.fyi` (Tim is owner) and already connected to OpenSEO's API **[verified, 2026-11-20]**. So the agent can read it today at no credit cost. But it shows **0 impressions in the last 28 days** **[verified]**. The first job is to find out why (sitemap not submitted, or pages not indexed yet). That's a 5-minute Tim task (section 1.7).
3. **Referral: no paid program.** At $1.99–$4.99 a referral payout is cents, and Apple gives no affiliate commission on in-app purchases. Recommendation: **the no-money "did your friend match?" loop already being built (#123/#129, recipient loop), plus App Store offer codes as a gifting and outreach tool.** No "share to unlock" rewards (section 3).
4. **ASO:** keep the name and subtitle in `app-store-listing.md` Variant A, fill the 100-character keyword field with the gaps competitors don't own (family, dinner, road trip, icebreaker, conversation), ask for ratings only after a "match" moment on adult screens, and ship two icons in the first binary so an icon A/B test is possible after launch.
5. **Android: about 1–2 weeks of engineering plus 2–3 weeks of Google's process**, so roughly 4–6 weeks on the calendar, and only after iOS v1 is stable. The calendar is set by Google's 14-day, 12-tester closed test for new personal accounts, not by the code. The biggest decision is the Play **target audience**: Kids & Family content can pull the app under Google's Families policy.
6. **Blind spot: the biggest SEO cluster (parents and kids pages) is invisible in PostHog by design** (no tracking on kids routes). Measure it with Search Console clicks and anonymous vote totals on `kf-*` questions, not with funnels.

## 1. SEO engine

### 1.1 Where we are

- **On `main`: 14 landing pages.** Twelve parent pages from batch 1 (kids, funny kids, kindergarten, elementary, gross, this-or-that kids, Thanksgiving, Christmas kids, family, dinner table, road trip, app), plus two thin couples pages from before batch 1 (`deep-would-you-rather-questions`, `questions-for-couples`). The two couples pages have no own question bank, intro or tips.
- **Live:** sitemap 344 URLs, `robots.txt` and `llms.txt` on `https://www.wouldyourather.fyi` **[verified by curl]**. The copies committed in `public/` still say `wyr-timfong888.vercel.app`; the build regenerates them, so this is cosmetic, but a fresh build commit would stop confusing agents that read the repo.
- **Draft, not merged: PR #66 (batch 2), 12 more pages:** the head term "would you rather questions" (246k, KD 14), funny (18.1k), hard (9.9k), teens (5.4k), work (4.4k), generator (590, $3.59 CPC), couples rebuilt (12.1k), questions to ask your partner (22.2k), first date (9.9k), couples games (14.8k), adults (8.1k), questions to ask your kids. It still needs Tim's human read of the Date Night and Party Pack questions.
- **Search Console:** verified, 0 rows for 2026-10-21 to 2026-11-17 **[verified]**.

**The highest-leverage SEO action is not new pages. It is merging batch 2 (#66) and getting all 26 pages indexed.** Batch 2 holds most of the measurable volume.

### 1.2 Keyword clusters

Sources: the OpenSEO / DataForSEO research already in `docs/seo/` (US, Nov 2026; about 620 credits spent across both batches). No new credits were spent for this spec. Free sources the agent can add each week: Search Console queries (first-party, best source once data exists), Google autocomplete and People Also Ask, Bing Webmaster Tools keyword research (free with a Bing account), Pinterest search suggestions (Pinterest ranks on page 1 for several of our queries). Paid, optional: OpenSEO `research_keywords` / `get_keyword_metrics`, capped at 600 credits per week.

Volumes are US monthly from the existing research; "unmeasured" means not yet pulled.

| Cluster | Covered (main + #66) | Gaps, best first | Volume, KD |
|---|---|---|---|
| **Parent / kid conversation** | 12 parent pages + questions to ask your kids | winter WYR (390, 0); bedtime questions; animal WYR; summer / Easter / Halloween / back-to-school seasonals; first graders (320), preschoolers (260), 3rd graders (260) as sections of existing age pages, not new pages | "kids" volume hidden by Google Ads, so infer from age variants |
| **Party / icebreaker** | funny, hard, work, generator (#66) | WYR icebreaker questions (720, 0); questions for friends (480, 5); sleepover questions (320, 0); this or that questions head term (~32k, 0); party games for groups | partly unmeasured |
| **Couples** | couples, partner, first date, couples games, adults (#66), deep | date night questions (1,300, 0); WYR for boyfriend (880) / girlfriend (260); WYR game for couples (590); this or that for couples (unmeasured) | spicy WYR (1,600) is **excluded**: it conflicts with the family brand and the 13+ rating |
| **Teens** | teens (#66) | WYR for students (590, 5); WYR for middle school / high school (unmeasured); group chat questions (unmeasured) | |
| **Classroom / teachers** | none | WYR for classroom; morning meeting questions; brain break questions; ESL WYR; printable WYR cards | **all unmeasured**; next research batch (about 300 credits) |

Classroom is the one new cluster. It also feeds outreach (section 2): teacher blogs and Teachers Pay Teachers want printables.

### 1.3 Page template

Keep `components/SeoLandingPage.tsx` and the field rules in `docs/seo-content-skill.md` section 3. They already match Google's guidance (answer-first H2, real FAQ, own items, last-updated date, JSON-LD built from the same data). Two additions:

1. **Printable pack link** on each list page: a one-page PDF of that page's free questions, generated at build time from the same data. Ranking pages offer PDFs; we don't. It is also the outreach asset (section 2).
2. **"How others answered"** once a question has 20 real votes (PRD threshold). Not before; never seeded numbers. This is the original data answer engines cite.

### 1.4 Internal linking

- Hub and spoke per cluster: each cluster has one hub (kids → `/would-you-rather-questions-for-kids`; all → `/would-you-rather-questions` from #66; couples → `/questions-for-couples`). Every spoke links up to its hub and to 2–3 siblings; the hub links to every spoke. The template already links "the persona's other pages"; make the hub link explicit.
- Seasonal pages link to the evergreen hub, and the hub links to the in-season page only while it's in season.
- Every question card links to its `/game/:id`, and `/game/:id` links back to the landing page that owns the question (already one owner per question, enforced by `verify-seo`).
- Teens and couples pages never link to kids pages and the reverse (different audiences, and kids pages carry no tracking).

### 1.5 Cadence

- **Weekly:** 2–3 new or rebuilt pages, at most. Ten good pages beat a hundred thin ones.
- **Seasonal lead time: about 8 weeks** to index. Valentine's pages (couples and kids) must ship by **mid-December 2026**; winter now; back-to-school by early July.
- **Monthly:** refresh pass on pages with impressions but position over 10 (rewrite the intro, add the questions people actually searched for).
- **Quarterly:** keyword research batch (one cluster, about 300 credits).

### 1.6 The autonomous loop

A scheduled task, fresh session per run, **Monday 09:17 Pacific** (off the hour so it isn't delayed), repo `timfong888/would-you-rather`, with the OpenSEO connector only.

| Step | What the agent does | Guardrail |
|---|---|---|
| 1. Read | `get_search_console_performance` (free): last 28 days by page and by query; "striking distance" queries (position 5–20, 50+ impressions); pages with 0 impressions after 3 weeks get `inspect_urls`. | Read-only. |
| 2. Pick | Score `docs/seo/backlog.md` (new file: keyword, cluster, volume, KD, season, status). Score = volume proxy × (1 / (KD+5)) × gap × season boost. Pick the top 2–3, or 1 refresh + 1–2 new. | Skip any keyword where it can't write one sentence on what the page does better than the current #1. |
| 3. Research | SERP check for the picks (`get_serp_results`, about 5 credits each). | Weekly cap **600 OpenSEO credits**; stop and report if hit. |
| 4. Draft | New questions written for the page, plus intro, tips, answer, FAQ, per the `seo-content` skill. Route file and `vercel.json` rewrite. | 10–25 new items per page; no item reused (build-enforced). Free content only. |
| 5. Check | `npm run build:web` (verify-data, verify-seo, sitemap, llms.txt). **Kids-safety pass:** a second model call reviews every kids item against the rules in the skill (no romance, violence, brands, scary themes, bodies, money, family situations) and a word list; any flag blocks the PR. **Thin-content pass:** each page's intro and items must be under a similarity threshold against every other page (e.g. no 8-word shingle shared with another page), at least 10 own items, intro + tips present. Phone screenshot of each new page (Playwright). | Fails = no PR, a report instead. |
| 6. Ship | Open a **draft** PR "SEO weekly YYYY-MM-DD", labels `seo-weekly` and `needs-human`, with the page table, the why-better-than-#1 line per page, the screenshots, and every new kids item listed for reading. | **Never merges, never deploys.** Tim reads the kids items and merges. |
| 7. Report | Comment on a pinned tracking issue: clicks, impressions, CTR, position by cluster vs last week; pages shipped; credits spent. | |

**The human gate is the merge.** Nothing reaches production without Tim. If Tim doesn't merge for 2 weeks, the agent stops opening new PRs (so they don't pile up) and only reports.

Quality guardrails, grounded in Google's policies:
- Google's spam policies treat **"scaled content abuse"** (many pages made mainly to manipulate rankings, by automation, people or both) as spam, and its generative-AI guidance says using AI to produce many pages without adding value may violate that policy ([Google Search Central blog, March 2024](https://developers.google.com/search/blog/2024/03/core-update-spam-policies); [Using gen-AI content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)) **[verified via search summaries; read the pages before quoting]**. The weekly cap, the one-intent-one-page rule, the "better than #1" sentence and the human merge are the answer to that.
- Google's [helpful content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) (people-first, original, satisfying) **[unverified: URL from memory]**. Our pages add something no ranking page has: one-tap play.

### 1.7 Search Console: what Tim needs to do

Already verified: `sc-domain:wouldyourather.fyi`, owner `tim@fong888.com`, connected to OpenSEO project "Would You Rather" **[verified]**. The API connection Tim asked about exists already; the weekly agent reads it through OpenSEO at no credit cost.

Tim, about 5 minutes:
1. Submit the sitemap: https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Awouldyourather.fyi → enter `https://www.wouldyourather.fyi/sitemap.xml` → Submit.
2. Check indexing: https://search.google.com/search-console/index?resource_id=sc-domain%3Awouldyourather.fyi. If pages show "Discovered, not indexed", request indexing for the hub pages with URL Inspection.
3. Bing Webmaster Tools: https://www.bing.com/webmasters → "Import from Google Search Console" (one click; also covers DuckDuckGo and ChatGPT search, which use Bing's index **[unverified]**).

If the property were ever lost, re-verify: https://search.google.com/search-console → Add property → Domain → `wouldyourather.fyi` → copy the TXT record → add it at the DNS host (Vercel: https://vercel.com/dashboard/domains) as a TXT on `@` → Verify. Keep the record.

## 2. Parent blogs and outreach

### 2.1 Who to find

| Source | How to find them | Why |
|---|---|---|
| Sites already ranking for our queries | The SERP tables in `docs/seo/` (growingplay, thebestideasforkids, allprodad, thefamilydinnerproject, readbrightly, todaysparent, mkewithkids, kokotree, lovetoknow, familyeducation) | They already wrote the article; pitch a resource update, not a new post |
| Parenting blog and newsletter lists | Feedspot "top parenting blogs" lists, Substack's parenting / family category, Beehiiv directory | Newsletters re-share printables |
| Teachers | Teachers Pay Teachers (free resources), teacher blogs ("morning meeting", "brain breaks"), We Are Teachers | Classroom cluster; printables |
| Homeschool | Homeschool blogs and co-op newsletters | High fit for daily conversation questions |
| Pinterest | Boards and pinners that pin "would you rather for kids" | Pinterest is on page 1 for several of our queries |
| Podcasts | Parenting podcasts that take guest pitches | Later, once there is a data report |

**Criteria (score each 0–2, keep ≥ 7 of 10):** posted in the last 60 days; audience is parents of 4–12, teachers, or couples (match to cluster); has a "would you rather" / conversation-starter article or a resources page; accepts guest posts or reader tips, or has a contact email on site; real site (not a link farm, no "sponsored post" price list). Exclude anything that sells links.

### 2.2 What to pitch

1. **Free printable question packs** (one per landing page, from section 1.3), no email required. Easiest yes for a blogger updating an old list.
2. **Embeddable "question of the day" widget**: a small iframe that shows one free question and a "play" link. Must be tracking-free (no cookies, no IDs, like `/api/og`), because it will sit on kids sites. Small build (a few days); after the printables prove interest.
3. **Guest posts** with a real angle ("12 questions that got our kids talking in the car", written by Tim). Data-led posts ("62% of families chose…") only after questions have real votes, per the PRD's Phase 2 for journalist outreach.
4. **Offer codes** for reviewers (section 3): one unlocked category per blogger who reviews the app.

### 2.3 The pipeline (agents draft, Tim sends)

A monthly scheduled task, fresh session:
1. **Research:** web search (Exa / TinyFish connectors) for new prospects per source above; dedupe against `docs/outreach/prospects.csv` (new file: site, URL, contact page, cluster, score, last contact, status). Contact emails only from the site's own contact page; no scraped personal emails, no enrichment databases.
2. **Draft:** for each new prospect with score ≥ 7, a short personal pitch that names their exact article and offers the matching printable. Drafts go in a PR to `docs/outreach/drafts/YYYY-MM.md`.
3. **Tim approves** in the PR, then sends from his own mailbox. **The agent never sends email**, never creates a sequence, never adds contacts to a mailing tool. One follow-up at most, also drafted for Tim.
4. **Track:** Tim (or the agent, from a reply Tim forwards) marks status; links gained are checked monthly with OpenSEO backlinks.

Target: 10 pitches a month, a 10–20% reply rate is normal for personalized resource pitches **[unverified benchmark]**.

## 3. Referral

### 3.1 Is a paid referral or affiliate program worth it? No.

- **The money:** at $1.99–$4.99, after Apple's 15% Small Business Program cut **[unverified: depends on enrolment]**, net is about $1.69–$4.24. A 20–30% referral commission is $0.34–$1.27 per sale. At a few percent free-to-paid conversion (PRD target 2–8%), a referrer earns cents per friend. Nobody shares for that, and the tracking costs more than the payouts.
- **Earning as an affiliate ourselves:** Apple stopped paying affiliate commissions on apps and in-app purchases in 2018 **[unverified, from memory]**, so "referral link" income from App Store links is not available.
- **Rules:** Apple requires In-App Purchase to unlock content; apps "may not use their own mechanisms to unlock content or functionality" (guideline 3.1.1, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). A home-made referral credit that unlocks a category is at risk under that reading; offer codes are Apple's sanctioned mechanism. **[3.1.1 wording from a model summary of the page, not verbatim-checked]**

### 3.2 The options without money

| Option | What it is | Apple rules | Verdict |
|---|---|---|---|
| **A. Match loop (recommended)** | Send a question; the friend answers on the web with no install; both see whether they matched. The reward is the result itself. Already built in #123/#129, recipient loop in progress. | No incentive, no unlock, nothing to review. | **Do this.** It is the PRD's share hook and needs no new rules. |
| B. "Send a question, unlock a bonus question" | Sharing unlocks content | 3.2.2(x): apps "must not force users to rate the app, review the app, download other apps, or other store-related actions", while they "may otherwise incentivize users to take specific actions within apps" **[model summary, not verbatim]**. 3.1.2(a) says paid content must not require "posting on social media" **[model summary]**. A share-gated unlock is grey, and gated content must never be something paid. | **No.** Small upside, review risk, and it trains people to spam. |
| C. Gift a category | A buyer gifts a category to a friend | Needs either IAP "gifting" (Apple has no native IAP gifting for non-consumables **[unverified]**) or offer codes | Later, via offer codes, if people ask |
| D. App Store offer codes | Apple-issued one-time or custom codes that unlock an IAP, redeemable in the App Store or by URL | Supported for all IAP types including non-consumables; promo codes were retired 2026-03-26; codes expire after up to 6 months; up to 1,000,000 redemptions per app per quarter ([App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases), [Apple news, Oct 2025](https://developer.apple.com/news/?id=gf6mgrs6)) **[verified via search summaries]**. One developer reports non-consumable codes failing ("not available") **[unverified forum report]**: test in sandbox first. | **Yes, as a tool**: blogger reviews, giveaways in parent newsletters, apology codes for support. Not as a referral program. |

Never: incentivized reviews or ratings (5.6.1: "Use the provided API to prompt users to review your app"; custom review prompts disallowed **[model summary]**), and never forced sharing to use the app (5.1.1(v): inviting friends is "not considered core app functionality" **[model summary]**).

**Recommendation: A, with D for outreach.** Measure A with `share_clicked` → recipient open → recipient vote (match rate), adult routes only.

## 4. App Store Optimization

### 4.1 Name, subtitle, keywords

Apple indexes name (30), subtitle (30) and the keyword field (100); a word in one is wasted if repeated in another. Keep Variant A from `app-store-listing.md`:
- Name: `Would You Rather? Family Fun` (already reserved in ASC)
- Subtitle: `Questions for the whole family`

Competitor gaps (from the competitor audit in `icon-strategy.md`): the top results own "would you rather", "adult", "dirty", "party", "couples", "this or that", "truth or dare", "21 questions". None owns **family, dinner, road trip, icebreaker, conversation, parents**. Keyword field (98 characters, singular forms, no spaces after commas, no "kids" because of guideline 2.3.8 **[verbatim-checked]**, no competitor names):

`game,icebreaker,road trip,this or that,date night,dilemma,conversation,parents,teens,couples,party`

Then iterate: after 2 weeks of App Analytics impressions by source, swap the weakest terms for `dinner`, `car`, `debate`, `starter`. App Store keyword popularity can only be seen in Apple Ads (Search Ads) **[unverified]**; create a free Apple Ads account to read popularity even without spending.

### 4.2 Screenshots and captions

The first 3 screenshots appear in search results and do most of the converting. Use the storyboard in `app-store-listing.md` section 2 ("Pick a side." / "Challenge a friend." / "Then see if they matched."). No vote-split screenshot until real counts exist. Re-test captions with a product page optimization test once the icon test ends (one test at a time).

### 4.3 Ratings prompt

- API: `AppStore.requestReview(in:)` / `SKStoreReviewController` (Expo: `expo-store-review`). StoreKit shows it at most 3 times in 365 days per device and may show nothing ([Apple docs](https://developer.apple.com/documentation/storekit/skstorereviewcontroller/requestreview(in:))) **[verified via search summary]**.
- When: right after a **positive moment** — a shared question comes back as a match, or the 15th answer across at least 2 sessions. Never in the first session, never after a paywall or an error, **never on kids routes** (the phone may be in a child's hands). Our own throttle: once per app version.

### 4.4 Localization later

English only at launch. Later, cheap wins: add English (UK) and English (Australia) localizations (the same text, region-specific keyword fields), and Spanish (Mexico), whose keywords are reportedly also indexed in the US store **[unverified ASO folklore; test]**.

### 4.5 Apple Ads (optional)

Apple Ads Basic charges per install with a monthly budget cap (historically $5,000) and is still offered **[verified that it exists; current cap and CPI unverified]**. Recommendation: **not before 50+ ratings and a measured conversion rate**; then a $150/month test on "family conversation" terms for 4 weeks, judged on cost per paying user, not per install.

### 4.6 Product page optimization (icon A vs B)

Up to 3 treatments against the original, one test at a time, up to 90 days, results in App Analytics; **alternate icons must be in the binary on the store** ([Apple](https://developer.apple.com/app-store/product-page-optimization/)) **[verified via search summary]**. So: put the winning icon and the runner-up from `icon-strategy.md` in the first production binary as alternate icons. Run the test once traffic is high enough to reach Apple's 90% confidence.

### 4.7 Campaign links

Use App Store Connect campaign links (`https://apps.apple.com/app/apple-store/id6836653723?pt=<provider token>&ct=<campaign>`) on every landing page "Get the app" button, every outreach pitch and every printable, one `ct` per source, so App Analytics shows installs by source. Tim gets the provider token in App Store Connect → Analytics → Campaigns **[unverified menu path]**.

## 5. Android

### 5.1 What must be stable on iOS first

1. v1 live on the App Store with IAP purchase and restore working in production, no P0 bugs for 2 weeks.
2. The share/recipient loop and share cards final (#123, #129, recipient loop), since Android shares differently (`url` is ignored; already handled in `nativeShareOptions`).
3. Analytics kids gating verified on native (`lib/analyticsCore.ts`), PostHog funnels in place (#85).
4. Privacy policy correct (the listing spec's blocker), final icon and adaptive icon art (`adaptive-icon.png` is still 1x1).
5. Catalog and paywall copy frozen, so RevenueCat products are set up once.

### 5.2 Steps and effort

| Step | Who | Effort |
|---|---|---|
| Google Play Console account, **US$25 one-time**, government ID verification (about 3 business days) ([Play help](https://support.google.com/googleplay/android-developer/answer/6112435)) **[verified via search summary]** | **Tim**: https://play.google.com/console/signup | 1 hour + wait |
| **Decide personal vs organization account.** New personal accounts must run a closed test with **at least 12 testers opted in for 14 continuous days** before applying for production ([Play help](https://support.google.com/googleplay/android-developer/answer/14151465)) **[verified via search summary]**. Organization accounts are reportedly exempt but need a D-U-N-S number (can take weeks) **[unverified]**. | **Tim** | decision |
| `eas.json` Android profiles, adaptive icon, `app.json` intent filters, Android App Links (`/.well-known/assetlinks.json` on the web domain), back-button and share-sheet checks | Agent | 2–3 days |
| `eas build -p android`; first `eas submit` to the **internal testing** track (Expo docs differ on whether the very first upload must be manual; if submit fails, upload the first AAB by hand) ([Expo](https://docs.expo.dev/submit/android/)) **[verified via search summary]**. Needs a Google service-account key in Expo credentials. | Agent + **Tim** (service account) | 1 day |
| RevenueCat Google Play: products in Play Console mirroring iOS, service-account JSON uploaded to RevenueCat (can take up to 36 hours to work), Real-Time Developer Notifications ([RevenueCat](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials)) **[verified via search summary]**. `react-native-purchases` is already a dependency. | Agent (`rc:sync` script) + **Tim** (Cloud project, Play permissions) | 1–2 days |
| Store listing, content rating questionnaire (IARC), **Data safety form**: PostHog analytics on adult screens (app interactions, device or other IDs), anonymous votes with coarse region, purchases via Google Play; nothing on kids routes | Agent drafts, **Tim** submits | half a day |
| **Target audience and Families policy** (below) | **Tim** decides | decision |
| Closed test, 12+ testers, 14 days (personal account only) | **Tim** recruits | 14 days |
| Production review | Google | a few days |

**Rough total: 1–2 weeks of agent work, about 4–6 weeks on the calendar** with a personal account.

### 5.3 Families policy: the real decision

If any target audience is children, Google's Families Policy applies (app removal or suspension for non-compliance); the separate Designed for Families program has been folded into it; apps must not send children's device identifiers; ads only from certified SDKs, no personalized ads ([Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335)) **[verified via search summary]**.

| Option | What | Trade-off |
|---|---|---|
| **A (recommended): target 13+**, Kids & Family stays as "play together with your family", listing aimed at parents | Matches the iOS 13+ rating and the 2026-11-18 decision that parents use the app. Our kids routes already send no analytics and no IDs. | Google may still judge the app "appealing to children" from the Kids & Family content and the "Family Fun" name **[unverified how strict]**; be ready to answer that in review. |
| B: include under-13 audiences | Families Policy in full, Families badge possible | Every SDK must comply (PostHog would have to be off app-wide or proven compliant), more review, and the adult categories conflict with a child audience. |
| C: Android without Kids & Family | Cleanest compliance | Drops the PRD's MVP persona from Android. |

### 5.4 Blind spot

Android users can already play everything on the mobile web with no install, and the PRD says the web app is the MVP. Android native adds store discovery and a home-screen icon, not new capability. If Play is slow (12-tester rule), a "Add to Home Screen" prompt on Android web is a cheap stopgap.

## 6. 30 / 60 / 90 days

Ranked by impact per effort within each window. "Auto" = runs as a scheduled agent; "Tim" = needs Tim.

### Days 1–30 (to 2026-12-20)

| # | Action | Who | Metric |
|---|---|---|---|
| 1 | Submit sitemap, check indexing, Bing import (section 1.7) | **Tim**, 5 min | GSC indexed pages; impressions > 0 within 2 weeks |
| 2 | Human read of #66 questions, merge batch 2 | **Tim**: https://github.com/timfong888/would-you-rather/pull/66 | 26 pages indexed |
| 3 | Valentine's pages (couples + kids) and winter page | Auto (first weekly run) → Tim merges | shipped by 2026-12-15 |
| 4 | Turn on the weekly SEO agent (section 1.6) | Agent sets it up after Tim's go | weekly PR + report |
| 5 | Ship v1 iOS with keyword field, 2 icons in binary, ratings prompt, campaign links | Agent + **Tim** (submit go) | ASC impressions, conversion rate, installs by `ct` |
| 6 | Printable PDF per page | Agent | `printable_downloaded` (adult pages only) |

### Days 31–60

| # | Action | Who | Metric |
|---|---|---|---|
| 1 | Outreach pipeline: first 10 drafted pitches | Auto drafts → **Tim** sends | replies, links gained |
| 2 | Classroom keyword batch (about 300 credits) + 3 pages | Auto → Tim merges | GSC impressions for the cluster |
| 3 | Monthly refresh pass on striking-distance pages | Auto | position and CTR change per page |
| 4 | Offer codes: 20 codes for bloggers / newsletter giveaways | **Tim** creates in ASC (agent drafts the list) | redemptions |
| 5 | Play Console account + personal/org decision | **Tim** | account verified |

### Days 61–90

| # | Action | Who | Metric |
|---|---|---|---|
| 1 | Android build, internal → closed test (12 testers, 14 days) | Agent + **Tim** | closed test complete |
| 2 | Icon product page optimization test | Agent configures, **Tim** starts | conversion lift at 90% confidence |
| 3 | Embeddable widget (if printables got pickup) | Agent | embeds, plays from embeds (adult only) |
| 4 | First data-led pitch, if questions have 20+ real votes | Auto drafts → Tim | press mentions |
| 5 | Apple Ads Basic test, only if ratings ≥ 50 | **Tim** budget | cost per paying user |

### Metrics

- **Search Console (all pages, including kids):** clicks, impressions, CTR, position by cluster, weekly. Read by the agent through OpenSEO.
- **PostHog funnels (adult routes only):** landing → `seo_cta_clicked` → first vote → `activated` (3rd vote, #85); `share_clicked` → recipient open → recipient vote (match rate); paywall view → purchase. **Kids routes send nothing by design**; for kids pages use GSC clicks plus anonymous total votes on `kf-*` questions.
- **App Store Connect:** impressions, product page views, conversion rate, installs by campaign (`ct`), ratings count.
- **North star for the next 90 days:** weekly organic clicks, and activated users from organic search.

## 7. Decisions for Tim

| # | Decision | Recommendation | Issue |
|---|---|---|---|
| 1 | Turn on the weekly SEO agent (draft PRs only, Tim merges) | Yes, 3 pages/week max, 600 credits/week cap | SEO issue |
| 2 | Review and merge #66 batch 2 | Yes, first | SEO issue |
| 3 | Outreach: approve the monthly draft pipeline; who sends | Yes; Tim sends from his own mailbox | Outreach issue |
| 4 | Referral approach | Match loop + offer codes; no paid program, no share-to-unlock | Referral issue |
| 5 | ASO keyword field and ratings-prompt timing | As in section 4; alternate icons in the first binary | ASO issue |
| 6 | Play account type and target audience | Personal account unless a D-U-N-S already exists; target 13+ | Android issue |

## 8. Proposed PRD changes

Not written into the Google Doc: the Drive tool in this session can only replace a whole file, which would risk the body. Proposed text, to add in blue with a comment under "Go To Market":

- **SEO and Agent Search:** "A weekly agent proposes 2–3 pages as a draft PR from Search Console data and a scored keyword backlog; a human reads kids content and merges. No page ships without that merge." Comment: makes the "autonomous" goal concrete without breaking the kids-safety rule.
- **New: Referral.** "No paid referral program. Growth from shares comes from the match loop (send a question, see if they picked the same). App Store offer codes are used for gifting and outreach." Comment: price points too low for paid referral; Apple rules.
- **Product Design, native apps:** "Android follows once iOS v1 is stable for 2 weeks; target audience 13+ on Google Play, Kids & Family played with a parent." Comment: Google Families policy.
