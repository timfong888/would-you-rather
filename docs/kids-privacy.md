# Kids routes: no tracking, no persisted IDs

Standing rule (Tim): **no tracking or persisted IDs on kids routes** (COPPA). Kids routes are every category whose
`audience` is `kids` (youngest age under 13; `constants/questions.ts`) with its routes
(`/categories|complete|unlock/<category id>`), the under-13 questions (`/game|p|results/kf-*`) and the kids-bank SEO
landing pages; `isKidsPath()` in `lib/kidsPaths.ts` is the single definition. It reads `audience`, never a list of
ids, so a new kids category is covered the moment it is defined; `tests/unit/audience.test.ts` fails if one is not.
`teen` categories (13 to 17) follow the adult analytics rules but keep the parental gate on purchases. Under-13
question ids use `kf-`, teen ids use `tn-`.

What the code does on those routes:
- `track()` and `identify()` return immediately (`lib/analytics.ts`), so no event, session or identify goes out.
- `wyr_visitor_id` is never read or created. An existing one is removed when a kids route is shown
  (`AnalyticsProvider`), and an in-memory ID is used for the page's life (`lib/visitorId.ts`).
- The match-share and share buttons add no `link_id`, `gen` or events there.
- Votes on kids questions (`kf-*`, `isKidsQuestion()`) send no `visitorId`, and nothing about them is stored:
  no `wyr_voted_v1` / `wyr_answered_questions` entry, no retry queue entry (`lib/votes.ts`,
  `hooks/useAnsweredQuestions.ts`). Kids entries left by older versions are removed when a kids route is shown.
  Consequence: a kids answer is not locked on a revisit, and kids progress is not kept between visits.
- The server ignores any `visitorId` on a kids vote and gives it a one-off random key with no player id
  (`api/_lib/votes.js`), so no two kids votes can be joined. `VOTER_KEY_SECRET` is no longer used.

**Do not add `EXPO_PUBLIC_POSTHOG_KEY` to the Vercel environment until this is on main** (this change, or #85's
`syncKidsMode` gating). Without a key the PostHog client is never created and nothing is sent.

Check: `tests/browserless/kids-no-tracking.mjs` (see its header), plus `tests/unit/visitor-id.test.ts`,
`tests/unit/votes.test.ts`, `tests/unit/handlers.test.ts` and `tests/unit/votes-client.test.ts`.
When #85 lands, fold this page into `docs/analytics.md`.

## How the gate decides (router path)
`lib/analytics.ts` treats the **router's pathname** as the source of truth (`setRouterPath`, called by the root layout while rendering, and by `syncKidsMode`). `window.location` lags an in-app navigation, so reading it let an adult → kids click send `$identify`, `session_start` and a kids-path `page_view` (#85 verification). `tests/browserless/analytics-network.mjs` proves it against a build with a fake PostHog key (PostHog's host intercepted): adult events reach `/batch`, kids routes send nothing, adult → kids in-app sends nothing.

PostHog on web uses `persistence: 'memory'`: the SDK otherwise throws "No storage available" and sends nothing. Identity is our own `wyr_visitor_id` via `identify()`, so PostHog writes no storage of its own.
