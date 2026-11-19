# Would You Rather: MVP engineering spec

Implements the acceptance criteria in [would-you-rather-mvp.md](would-you-rather-mvp.md) (AC-1 to AC-15).
Status: draft for review, 2026-11-17. Vote storage, the vote API and the result display (FR-1, FR-2, BR-2) are built: see [vote-counts.md](vote-counts.md). The rest is not built yet.

## 1. What exists today

| Area | Today | Gap against the ACs |
|---|---|---|
| App | Expo Router (Expo 51) exported as a static web app, hosted on Vercel; `vercel.json` rewrites routes to HTML files | none |
| Server | Vercel functions in `api/` (`/api/card`, `/api/p/[id]` share pages); `api/_lib/data.js` is a hand-kept copy of the question list | Two copies of the questions can drift |
| Questions | `constants/questions.ts`: 9 categories, each question has invented `votesA`/`votesB` | No kids' category (AC-1, AC-7); seeded counts (AC-5) |
| Votes | Not stored anywhere; results show the seeded counts | AC-4, AC-5, AC-6, AC-8 |
| Player ID | `getOrCreateVisitorId()` in `lib/analytics.ts`: UUID in `localStorage` on web; **a new UUID on every call on native** | Web is fine for the MVP; native needs fixing before the apps ship |
| Paywall | `FREE_TRIAL_COUNT = 3`; `$2.99` category unlock; payment is simulated with `setTimeout`; unlocks kept in `localStorage` | AC-11, AC-12, AC-13 |
| Analytics | PostHog | Event list in AC-15 not yet complete |
| Tests and CI | No test runner, no GitHub Actions; the Vercel build runs `verify:data` and `verify:seo` | See the test plan |

## 2. Architecture

```
Browser (static Expo web app)
  ├─ GET  static pages + question bundle        (Vercel CDN)
  ├─ POST /api/votes                            (Vercel function, Node) ──► Neon Postgres
  ├─ GET  /api/tallies?ids=...                  (Vercel function, CDN-cached 60 s) ──► Neon Postgres
  ├─ POST /api/checkout                         (Vercel function) ──► Stripe
  ├─ GET  /api/unlock?session_id=...            (Vercel function) ──► Neon Postgres
  ├─ GET  /api/restore?token=...                (Vercel function) ──► Neon Postgres
  └─ GET  /api/card, /api/p/[id]                (existing share card/page; now read tallies)
Stripe ──webhook──► POST /api/stripe-webhook ──► Neon Postgres
```

Decisions (made here, open to challenge on the PR):

- **D1 Database: Neon Postgres** via `@neondatabase/serverless` (HTTP driver, no connection pool to
  manage), per #65. Chosen over Vercel KV because AC-6 needs a unique constraint and the data
  reports need SQL.
- **D2 Payments: Stripe Checkout** in payment mode with Apple Pay and Google Pay enabled, no
  customer account. Checkout handles wallets, receipts and refunds, so we build no payment UI.
  RevenueCat is the candidate for native apps later; it is not needed for web.
- **D3 Single source of questions.** `constants/questions.ts` stays the source. A build step
  generates `api/_lib/questions.generated.js` from it, replacing the hand-kept `data.js` list.
- **D4 Thresholds and prices are config**, in `constants/config.ts`: `VOTE_THRESHOLD`,
  `FREE_QUESTIONS_PER_CATEGORY`, `PACK_SIZE`, `PACK_PRICE_CENTS`. Tests read these values instead of
  hard-coding them.

## 3. Data model

### 3.1 Question (static, in the bundle)

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | `^[a-z]{2,4}-\d+$`, unique |
| `category` | `CategoryId` | yes | existing union plus kids' category ids |
| `optionA`, `optionB` | string | yes | 1–160 chars |
| `volume` | int | no | ≥1, default 1 |
| `review` | `{ status: 'approved' \| 'rejected' \| 'pending', reviewer: string, date: 'YYYY-MM-DD' }` | yes when the category's audience is `kids` | build fails otherwise (AC-7) |

`votesA` and `votesB` are deleted. `CategoryDef` gains `audience: 'kids' | 'everyone' | 'adults'` (required).
`verify-questions.ts` fails the build if a kids' question lacks `review.status === 'approved'`, or
if any question carries a vote count.

### 3.2 `votes` table

| Column | Type | Null | Rules |
|---|---|---|---|
| `id` | `bigint generated always as identity` | no | PK |
| `question_id` | `text` | no | must exist in the generated question list (checked in the handler) |
| `choice` | `char(1)` | no | `check (choice in ('A','B'))` |
| `voter_key` | `text` | no | see 3.4; unique with `question_id` |
| `player_id` | `uuid` | yes | **null for kids' categories** (AC-8); the visitor UUID otherwise |
| `kids` | `boolean` | no | true when the question's category audience is `kids` |
| `country` | `char(2)` | yes | ISO 3166-1 alpha-2 from `x-vercel-ip-country` |
| `region` | `text` | yes | ≤3 chars, from `x-vercel-ip-country-region` |
| `created_at` | `timestamptz` | no | default `now()`, stored in UTC |

Constraints and indexes:
- `unique (question_id, voter_key)`: enforces one vote per device per question (AC-6); `insert ... on
  conflict do nothing` makes retries safe. It also serves the tally query below, because
  `question_id` leads.
- `check (not kids or player_id is null)`: the database itself refuses a kids' vote with a player ID.
- Tally query: `select question_id, choice, count(*) from votes where question_id = any($1) group by 1, 2`.
  Covered by the unique index (`question_id` leading). No other index until a report query needs one.
- No IP column exists anywhere (AC-8).

### 3.3 `purchases` table

| Column | Type | Null | Rules |
|---|---|---|---|
| `id` | `uuid` | no | PK, `gen_random_uuid()` |
| `stripe_session_id` | `text` | no | unique (makes the webhook idempotent) |
| `category_id` | `text` | no | a paid category |
| `pack_volume` | `int` | no | ≥2 |
| `status` | `text` | no | `check (status in ('paid','refunded'))` |
| `created_at` | `timestamptz` | no | default `now()` |

States: `paid → refunded` is the only transition (from the `charge.refunded` webhook). `refunded → paid`
is invalid. A pending or failed Checkout creates no row.

### 3.4 Voter key

- Not kids: `voter_key = visitor UUID`; `player_id = visitor UUID`.
- Kids: the client sends no `visitorId`; `voter_key = 'kids:' + randomUUID()` (one-off, never joinable); `player_id = null`.
  (Was an HMAC of the visitor id per question until the kids-storage fix in PR #105.)
  Because the key differs per question, two kids' votes cannot be joined to one player, yet the
  unique constraint still stops a device voting twice on the same question.

## 4. Interfaces

All handlers are synchronous request/response unless marked async. Bodies are JSON.

### FR-1 `POST /api/votes` (AC-4, AC-6, AC-8)
`recordVote({ questionId, choice, visitorId }) → 201 { counted: true, tally } | 200 { counted: false, tally } | 400 | 429 | 503`
1. Validate: `questionId` exists, `choice ∈ {A,B}`, `visitorId` is a UUID v4. Otherwise 400 `{ error, field }`.
2. Look up the category audience; build `voter_key` and `player_id` per 3.4.
3. Read `x-vercel-ip-country` / `x-vercel-ip-country-region`; never read or log the IP.
4. In one transaction: `insert ... on conflict (question_id, voter_key) do nothing`, then the tally query for this question. Inserted: 201 `{ counted: true, tally: { a, b } }`; conflict: 200 `{ counted: false, tally: { a, b } }`. The tally is read after the insert commits in the same transaction, so it already includes this vote (or the earlier one from this device).
5. Database error or timeout (2 s): 503 `{ error: 'unavailable', retryable: true }`.
6. Rate limit: a Vercel Firewall rule, 30 requests per minute per IP; over it, 429 `{ retryable: true }`. Applied at the edge, so no IP reaches our code or database.
- Client: `castVote()` shows the result screen at once with the local choice and the invite text (AC-4),
  then replaces the invite with `formatResult(response.tally)` when the response arrives. The client never
  adds its own vote to a count: the only numbers shown on the result screen come from this response.
  On 503, 429 or network failure the screen keeps the invite text, and the vote is kept in `localStorage`
  and retried once on the next app load (async).
- Perf: p95 ≤ 300 ms server time.

### FR-2 `GET /api/tallies?ids=q1,q2` (AC-9: share cards and previews only)
`getTallies(ids: string[]) → 200 { [questionId]: { a: number, b: number } } | 400`
- 1–50 ids; unknown ids return `{a:0,b:0}`. `Cache-Control: s-maxage=60, stale-while-revalidate=300`.
- Client display rule (`formatResult(tally, threshold)`):
  `a + b < VOTE_THRESHOLD` → `{ kind: 'invite' }`; otherwise `{ kind: 'percent', a: round(100a/(a+b)), b: 100 − a%, total }`.
  The result screen does not call this endpoint (it uses FR-1's response), so a cached tally is never mixed
  with a just-cast vote. Share cards may lag by up to 60 s; that is acceptable.
- On error or timeout (1.5 s): `{ kind: 'invite' }`. The app never shows a number it did not get from the server.
- Perf: p95 ≤ 200 ms at the CDN.

### FR-3 Share link (AC-9, AC-10)
`buildShareUrl(questionId, choice, gen) → /p/{id}?link_id={uuid}&gen={n}&pick={A|B}`
- Extends the existing `buildShareUrl`. Public `/p/:id` links are served by `vercel.json` as static
  HTML from `scripts/generate-sharing-pages.mjs`, not by `/api/p/[id]`, so the change is made there:
  - The generated page stops embedding build-time counts: `og:description` uses fixed copy ("Which
    side are you on? Tap to vote."), and the only live numbers come from `og:image`, which already
    points at `/api/card?id=…`. `/api/card` renders from `getTallies`, with the same threshold rule.
  - The page's redirect script forwards `pick` along with `link_id` and `gen`.
  - `/api/p/[id]` is left as is (it is not routed publicly) and is removed in a later cleanup.
- The question screen reads `pick` and shows "Your friend picked {option} — what's yours?". An invalid `pick` is ignored.

### FR-4 Payments (AC-11, AC-12, AC-13)
- `POST /api/checkout { categoryId, volume } → 200 { url } | 400 | 503`: creates a Stripe Checkout
  Session (`mode: payment`, price from `PACK_PRICE_CENTS`, `success_url=/unlock/{id}?session_id={CHECKOUT_SESSION_ID}`).
- `POST /api/stripe-webhook` (async, from Stripe): verifies the signature; on
  `checkout.session.completed` upserts `purchases` by `stripe_session_id` (a retry hits the same row
  and the same `id`); on `charge.refunded` sets `status='refunded'`. Returns 2xx after commit;
  Stripe retries any other response, so the handler is idempotent.
- Restore token: `restoreToken(purchaseId) = purchaseId + '.' + base64url(HMAC-SHA256(RESTORE_TOKEN_SECRET, purchaseId))`.
  It is computed, never stored, so any later request can reproduce it, and webhook retries yield the same
  token. `verifyRestoreToken(token) → purchaseId | null` recomputes the HMAC and compares in constant time.
- `GET /api/unlock?session_id= → 200 { categoryId, volume, restoreToken } | 202 (webhook not yet
  processed; client polls every 1 s, up to 10 s) | 404 | 410 (refunded)`. It returns 200 only when
  `status = 'paid'`, the same check as `/api/restore`, so reopening an old Checkout return URL cannot
  unlock a refunded purchase on a new device (BR-5). The client then stores the unlock locally
  and shows the next question (AC-12) and the receipt link `/restore?token=...` (AC-13).
- `GET /api/restore?token= → 200 { categoryId, volume } | 404 (bad signature or unknown purchase) | 410 (refunded)`.
- A cancelled Checkout returns to `/unlock/{id}?cancelled=1`: the category stays locked and the
  page says nothing was charged (AC-12).
- Stripe outage: `/api/checkout` returns 503 and the paywall shows "Payments are down, try again
  soon". No retries, no circuit breaker: the player retries by hand.

### FR-5 Analytics (AC-15)
`track(event, props)` in `lib/analytics.ts` (PostHog). Props never include IP, name or email;
PostHog IP capture is turned off (`disable_geoip` and the project's "discard IP" setting). `activated`
fires once per session, on the fifth `question_answered`.

Kids' policy (AC-8, AC-15). Today `AnalyticsProvider` calls `identify(visitorId)` and events carry
`visitor_id`, which would link a child's answers in PostHog even with the database HMAC. So:
- `identify()` is no longer called at startup; it is called only when a player answers a question
  outside a kids' category.
- Any event raised on a kids' category screen (`question_answered`, `share_clicked`, `paywall_viewed`,
  ...) is sent through `trackKids(event, { category })`, which sends no `question_id`, `choice` or
  `visitor_id`, uses a fresh random `distinct_id` per event and sets `$process_person_profile: false`.
  Two kids' events therefore share no identifier.
- `activated` counts kids' answers in local session state, so activation is still measured.

## 5. Business rules

- BR-1 One counted vote per `(question, voter_key)`; enforced by the unique constraint, not by app code.
- BR-2 Results show percentages only when `a + b ≥ VOTE_THRESHOLD`.
- BR-3 Paid categories allow `FREE_QUESTIONS_PER_CATEGORY` questions before the paywall; free
  categories have no paywall for volume 1.
- BR-4 Kids' votes never carry `player_id` (database check constraint).
- BR-5 A refunded purchase stops restoring on new devices (410). Devices already unlocked stay
  unlocked; we accept that loss.

## 6. Non-functional requirements

- Latency: FR-1 p95 ≤ 300 ms, FR-2 p95 ≤ 200 ms; first question interactive within 3 s on a
  mid-range Android phone on 4G (Lighthouse "Moto G Power" profile).
- Load: 50 votes per second sustained (about 10× a strong launch day), within Neon's free or
  Launch tier.
- Availability: votes and tallies degrade to the invite screen, never an error page (FR-1, FR-2).
- Privacy: COPPA (children under 13: no personal data collected in kids' categories, per BR-4 and
  no accounts), GDPR (no IP stored; the visitor UUID is pseudonymous personal data, so the privacy
  page must say so and say how to clear it).
- Secrets: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VOTER_KEY_SECRET`, `RESTORE_TOKEN_SECRET` in Vercel
  environment variables only.

## 7. Risks

| Risk | Likelihood × impact | Mitigation |
|---|---|---|
| Removing seeded counts leaves every result on the invite screen for weeks, weakening the "you vs everyone" hook | High × Medium | Low threshold option (5); the share invite is designed to be the hook while counts build |
| Kids' content is unsafe or thin at launch, and the parent SEO pages land on adult questions | High × High | AC-7 build check; the kids' category ships before the parent pages point to it; FAMILY_FRIENDLY is removed from the kids page |
| Vote stuffing skews published results | Medium × Medium | Firewall rate limit, one vote per device; reports exclude questions below the threshold |
| COPPA exposure if a kids' vote is linkable | Low × High | Per-question HMAC key, null `player_id`, database check |
| Webhook delay makes a paid player wait | Medium × Low | 202 + polling up to 10 s, then "Your purchase is confirmed; refresh in a minute" |
| Native visitor ID is regenerated on every call | Certain (native only) × High for native | Out of MVP scope; must be fixed (persisted with AsyncStorage) before native apps |
| Apple Pay on web needs domain verification on the final domain | Medium × Medium | Verify `wouldyourather.fyi` in Stripe before launch; card payment works regardless |

## 8. Open questions

| # | Question | Blocks | Owner | Decide by |
|---|---|---|---|---|
| Q1 | `VOTE_THRESHOLD`: 5 / 10 / 20 (PRD says 20) | AC-5 tests | Tim (PM) | before the votes PR (#65) |
| Q2 | Free questions per paid category: 3 (today) / 5 (PRD) | AC-11 tests | Tim (PM) | before the payments PR |
| Q3 | Pack price $1.99 / $2.99 (today) / $4.99, and size 25 | AC-11 | Tim (PM) | before the payments PR |
| Q4 | Kids' age band (6–12?) and launch size 30 / 50 / 100 | AC-7, content | Tim (PM) | before kids' content is written |
| Q5 | Can a player change a vote? Spec assumes no: the first vote counts | AC-6 wording | Tim (PM) | before the votes PR |
| Q6 | Accept PRD edit E3: reviewed packs and a receipt link instead of AI-generated packs? | AC-13, FR-4 | Tim (PM) | before the payments PR |
| Q7 | Who reviews kids' questions, and is one reviewer enough? | AC-7 | Tim (PM) | before kids' content ships |

## 9. Spec review (spec-review skill: technical accuracy, implementation readiness)

First-draft findings and what changed. Scores are for the revised text above.

**Technical accuracy: 82/100** (stories 8, data model 9, requirements 8, architecture 8, business logic 9, NFRs 8, testing 7)
- Critical, fixed: the draft relied on "store no player ID for kids" while also enforcing one vote
  per device, which needs a device key. Added the per-question HMAC `voter_key` (3.4) and a database
  check constraint.
- High, fixed: the draft added an index on `(question_id, choice)`; the unique index already leads
  with `question_id` and serves the tally query, so the extra index was removed.
- High, fixed: the draft rate-limited by storing IP hashes in Postgres, contradicting AC-8. Moved the
  limit to the Vercel Firewall.
- High, fixed: no defined behaviour for a late webhook; added the 202 + polling contract.
- Medium, open: no load test is planned for 50 votes/s; the test plan covers correctness only.

**Implementation readiness: NEEDS CLARIFICATION** (blocked only by Q1–Q7, all owned and dated)
- Critical, fixed: thresholds and prices were hard-coded in prose; now config values (D4) so tests
  don't decide them for Tim.
- High, fixed: the purchase status enum and its invalid transition were implied; now stated (3.3).
- High, fixed: error responses lacked bodies and a retryable flag; added per endpoint.
- PR review (Blocks, 3 × P1), fixed: (1) the restore token was stored only as a hash, so `/api/unlock`
  could not return it; it is now a reproducible HMAC of the purchase id. (2) PostHog `identify` and
  `visitor_id` would still link a child's answers; added the kids' analytics policy in FR-5. (3) The
  client added its own vote to a possibly cached tally; FR-1 now returns the committed tally and the
  client never increments counts.
- PR review round 2 (1 × P1), fixed: `/api/unlock` did not check refunds, so an old Checkout return
  URL bypassed BR-5; it now requires `status = 'paid'` and returns 410 otherwise.
- PR review round 3 (1 × P1), fixed: FR-3 targeted `/api/p/[id]`, but public `/p/:id` is static HTML
  that embeds build-time counts and drops `pick`; FR-3 now changes the generator instead.
- Medium, open: `region` format varies by country (Vercel passes ISO 3166-2 suffixes); keep it
  as given and normalise in reports.
