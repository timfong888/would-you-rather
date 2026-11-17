# Would You Rather: MVP test plan

Maps every acceptance criterion in [would-you-rather-mvp.md](would-you-rather-mvp.md) to a test and
a CI job. The spec is [would-you-rather-mvp-spec.md](would-you-rather-mvp-spec.md).

## Tooling to add (in the first implementation PR, not this one)

The repo has no test runner and no GitHub Actions today; the Vercel build runs `verify:data` and
`verify:seo`. Add:

| Layer | Tool | Runs against |
|---|---|---|
| Unit | Vitest | pure functions (`formatResult`, voter key, display rules) |
| Integration | Vitest + a Postgres 16 service container | API handlers called as functions, a real database, Stripe replaced by its official test fixtures and signed sample webhook payloads |
| End-to-end | Playwright (the pre-installed Chromium) | `npm run build:web` output served locally; `/api/*` stubbed with `page.route` fixtures, except the e2e-db job below |
| Build checks | existing `verify:data`, `verify:seo` | the question bundle and SEO pages |

CI: a new `.github/workflows/ci.yml` with jobs `unit`, `integration`, `e2e`, all required on PRs.
The Vercel preview build keeps running the build checks. Rules from the acceptance-tests skill
apply: no live network, fixed clock and random seed, no sleeps, no test-order dependence.

**Who writes what.** Tests marked **X** live in `tests/acceptance/` and are written by a different
model family from the one writing the code (for example, Codex writes them when Claude codes),
before implementation; the coder may not edit them. Unit tests without the mark are written by the
coder.

## Map

| AC | Test | Type | CI job | X |
|---|---|---|---|---|
| AC-1 | Kids landing page lists only kids' questions; Play opens a kids' question; no sign-in element on the path | e2e | e2e | X |
| AC-1 | Every question on each kids SEO page belongs to a `kids` category | build check (`verify:seo`) | Vercel build, unit | |
| AC-2 | `/categories` shows every category with an audience label; kids' categories come first | e2e | e2e | X |
| AC-3 | From `/`, a new browser context reaches a question in ≤2 taps; no sign-in, account or email field appears | e2e | e2e | X |
| AC-4 | Tapping an option sends one `POST /api/votes` and shows the result with the choice highlighted | e2e | e2e | X |
| AC-4 | With `/api/votes` stubbed to 503 and to a network abort, the result screen still shows the choice and the invite text; one retry happens on next load | e2e | e2e | X |
| AC-5 | `formatResult` at threshold − 1, threshold, and 0 votes; percentages sum to 100 (including 1/3 splits) | unit | unit | X |
| AC-5 | Result screen shows no "%" and no "0" below the threshold, and percentages plus total at it (tallies stubbed) | e2e | e2e | X |
| AC-5 | Build fails if any question has `votesA`/`votesB` | build check (`verify:data`) | Vercel build, unit | |
| AC-6 | Two posts of the same question from one visitor: total stays 1; second returns `counted:false`; concurrent duplicate posts also give 1 | integration | integration | X |
| AC-7 | Build fails when a kids' question lacks `review.status = approved`; passes when all are approved; kids' category has ≥ launch size | build check + unit on the checker | unit | X |
| AC-8 | A non-kids vote stores question, choice, UTC date, country, region and no IP column exists; a kids' vote has `player_id` null; two kids' votes from one visitor have different `voter_key`s; inserting a kids' row with a player ID fails at the database | integration | integration | X |
| AC-9 | Share produces `/p/{id}?…&pick=`; opening it in a fresh browser context shows that question; `/api/p/[id]` card shows percentages or invite text per threshold | e2e + integration | e2e, integration | X |
| AC-10 | Opening a link with `pick=A` shows "Your friend picked {optionA} — what's yours?"; an invalid `pick` shows the plain question | e2e | e2e | X |
| AC-11 | In a paid category, question number `FREE_QUESTIONS_PER_CATEGORY + 1` shows the paywall with `PACK_PRICE_CENTS` and `PACK_SIZE`, and no account field | e2e | e2e | X |
| AC-12 | Signed `checkout.session.completed` fixture creates one purchase (replayed twice: still one); `/api/unlock` returns 202 then 200; UI shows the next question without reload; cancelled return keeps it locked and shows "nothing was charged"; bad signature returns 400 | integration + e2e | integration, e2e | X |
| AC-13 | Restore token unlocks the pack in a fresh browser context; a refunded purchase returns 410; an unknown token returns 404 | integration + e2e | integration, e2e | X |
| AC-14 | Settings has "Feedback and refunds" whose `mailto:` carries the support address and app version | e2e | e2e | X |
| AC-15 | With PostHog stubbed, a 5-answer session emits `question_answered` ×5 and `activated` ×1; no event props contain an IP, email or name | e2e | e2e | X |

Tests that need an open value (Q1–Q4 in the spec) read it from `constants/config.ts`, so choosing a
value never means rewriting a test. AC-13 tests wait for Q6.

## Not covered here

- Load (50 votes/s): a one-off k6 run against a Vercel preview before launch, not in CI.
- Content quality of kids' questions: human review (spec Q7), enforced only as a flag by AC-7.
