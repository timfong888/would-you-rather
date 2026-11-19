# Vote counts: real votes, the 20-vote threshold, and where they are stored

Implements issue #65 (real stored votes) for the vote store, the vote API and the result display.
It narrows `would-you-rather-mvp-spec.md` FR-1, FR-2, BR-1, BR-2 and BR-4 to what is built.

## Decision record

| Date | Decision | Source |
|---|---|---|
| 2026-11-18 | Real vote counts approved. | Tim: "2. Agree, real vote counts and that we can document these." (relayed by the orchestrator session; recorded on #65) |
| 2026-11-18 | Storage is Neon Postgres. No KV, no JSON. | Tim: "I believe the selection for database is Neon Postgres because we can't just use KV or even JSON, because we need to use the data as part of the autonomous growth" |
| 2026-11-17 | Display threshold 20 votes; never show "0"; share prompt below it; seeded counts removed. | #65 |

## What players see

| Situation | Result screen, feed card, share card |
|---|---|
| Fewer than 20 votes on the question | No percentage, no "0", no vote count. A "New question" card: "Send it to someone and see if they pick the same." |
| 20 votes or more | Real split and total: "68% of 25 players chose Option A", both bars, "N players". The split is `round(100·a/(a+b))` for A and `100 − that` for B, so it always sums to 100. |
| Server slow, down, or storage not configured | Same as fewer than 20: the invite. The app never shows a number it did not get from the server, and never an error page. |
| Just voted | The game screen shows the tally returned by the vote request itself, which already includes the player's vote. The app never adds +1 to a count. |
| Result screens opened later (`/results/:id`, `/complete/:id`, feed) | Counts from `GET /api/tallies`, cached up to 60 s, so a vote just cast may lag by up to a minute on these screens. |

The rule lives in one file, `lib/results.js` (`formatResult`, `VOTE_THRESHOLD = 20`), imported by the app and by the Vercel functions.
Change the threshold there only.
The 20 applies to the total on the question (`a + b`), not to each side.

Seeded `votesA` / `votesB` are deleted from `constants/questions.ts`, `constants/kidsQuestions.ts` and `api/_lib/data.js`.
`npm run verify:data` fails the build if any question carries one again.

## Storage

Neon Postgres, `db/migrations/001_votes.sql` (idempotent), table `votes`, one row per counted vote.
Rows are raw and append-only. They are not counters, so any report can slice them by question, time, region or device later.

| Column | Meaning |
|---|---|
| `question_id`, `choice` (`A`/`B`) | What was answered |
| `created_at` (timestamptz, UTC) | When |
| `player_id` (uuid) | Anonymous per-device ID from the browser (`wyr_visitor_id`). `NULL` for kids' votes |
| `voter_key` | Uniqueness key. Not kids: the same UUID. Kids: HMAC-SHA256 of `visitorId:questionId` with `VOTER_KEY_SECRET` |
| `kids` | True for the Kids & Family category |
| `country`, `region` | From `x-vercel-ip-country` and `x-vercel-ip-country-region`. Not stored for kids' votes |

There is no IP column. The handlers never read the IP.

Example: answers per question per week and region, only where the cell has at least 20 votes.

```sql
select question_id, date_trunc('week', created_at) as week, country, region,
       count(*) filter (where choice = 'A') as a, count(*) filter (where choice = 'B') as b
from votes where not kids
group by 1, 2, 3, 4 having count(*) >= 20;
```

Kids' rows have no `player_id`, no region and a one-off random key (the client sends no visitor ID, and the server ignores one if sent), so they cannot be joined to a device or to each other.
The database refuses a kids' vote with a `player_id` (check constraint `votes_kids_anonymous`).
`VOTER_KEY_SECRET` is no longer used (it keyed the old per-question HMAC).

Retention: rows are kept indefinitely and nothing deletes them automatically. #65 recommends this, and Tim has not separately confirmed it.
Deletion on request (`delete from votes where player_id = $1`) is possible for non-kids' votes; there is no request channel in the product yet.

## One vote per device per question (abuse)

`unique (question_id, voter_key)` makes a second vote from the same browser a no-op: HTTP 200, `counted: false`, the first choice is kept.
**Not for kids' questions:** each kids' vote has a one-off key and nothing is stored on the device, so answering the same `kf-*` question again (after a reload or a revisit) inserts another vote. That is the price of keeping kids' votes unlinkable; kids' counts rely on the Firewall rate limit and the reporting threshold.
This stops double-clicks, retries and casual re-voting. It does not stop someone who clears localStorage or uses another browser or device.
Per-IP rate limiting is a Vercel Firewall rule (spec FR-1), configured in the dashboard, not in code.
Reports should only publish questions at or above the threshold.

## API

| Route | Behaviour |
|---|---|
| `POST /api/votes` `{ questionId, choice, visitorId }` (kids' questions: no `visitorId`) | Validates, stores, returns `{ counted, choice, tally: { a, b } }` (`choice` is the stored one). The insert and the read-back are two statements, so two tabs voting at once still read each other's committed vote. 201 counted, 200 already voted, 400 invalid, 503 storage unavailable (`retryable`). 2 s database timeout |
| `GET /api/tallies?ids=a,b` (1 to 50 ids) | `{ id: { a, b } }`, unknown ids `{a:0,b:0}`. `Cache-Control: s-maxage=60, stale-while-revalidate=300`. 503 is never cached |

A confirmed answer is final in the app (the old "Change my answer" button is removed): the server keeps the first choice, so letting the player change it would show an answer that was never stored.
On a revisit or reload the game screen restores and locks the answer the server acknowledged (or one queued for retry; `wyr_voted_v1` in localStorage; never for kids' questions, which store nothing); it only reads counts and sends no vote. Answers saved by older versions (`wyr_answered_questions`, never sent to the server) do not lock anything, so those players can still vote. If the player somehow votes again with a different choice, the vote response carries the stored `choice` and the app shows and keeps that one, not the one just tapped.
The client retries a vote that failed with 503, 429 or a network error once on the next app load (web only, kept in localStorage; kids' votes are not queued or retried).

## Configuration

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Neon connection string. Without it both routes answer 503 and every screen shows the invite |
| `VOTER_KEY_SECRET` | Kids' votes (random, at least 32 bytes). Never rotate casually: it changes every kids' `voter_key`, so the same child can vote again |
| `WYR_VOTE_STORE=memory` | Local development only: in-memory store, lost on restart |

The `votes` table creates itself: if the first vote finds it missing (Postgres error `42P01`), the idempotent statement in `api/_lib/schema.js` runs once and the write is retried once. A read of a missing table returns "no votes" and creates nothing. No manual step is needed.
`db/migrations/001_votes.sql` holds the same statement (a test keeps them identical); `DATABASE_URL=... npm run db:migrate` or pasting it into the Neon SQL Editor does the same thing by hand.
Later schema changes (new columns, indexes, rollups) will need a real migration step; self-creation only covers the first table.

## Not built here (still open on #65)

- "Your friend picked X, what's yours?" on shared links (spec FR-3).
- Rollup tables and the Vercel Cron job (`question_totals`, `vote_daily`). Counts are computed from the raw rows. At 1 vote per second that is fine; the 20-vote threshold and the 60 s cache keep the read cheap. Add the rollups before heavy traffic or before ordering the feed by popularity across all questions.
- Linking `player_id` to accounts (sign-in), demographics, and the PostHog `vote_cast` event: out of scope.
- A deletion-request channel and a full privacy policy review (the policy's analytics paragraph already contradicts the PostHog setup).
- `api/card.jsx` and `api/p/[id].jsx` use the `.jsx` extension and production returns `NOT_FOUND` for `/api/card` today, so share cards do not render at all in production. `api/votes.js` and `api/tallies.js` are plain `.js`, which Vercel does build as functions. Confirm after the first preview deploy that `/api/tallies?ids=hl-1` answers.
- The feed's "Trending" order only ranks the 30 questions on screen by their real counts.
