# Analytics

One analytics tool: **PostHog**, behind the single wrapper `lib/analytics.ts` (UI code never calls the SDK).
With no key set nothing is sent and nothing throws.

## Key setup per environment

| Environment | `EXPO_PUBLIC_POSTHOG_KEY` |
|---|---|
| Vercel Production | optional: the public production token is committed as the default (`lib/analytics.ts`) and used only on `www.wouldyourather.fyi` |
| Vercel Preview | the WYR dev project key |
| Local | leave empty, or set `EXPO_PUBLIC_ANALYTICS_DEBUG=true` to log events to the console |

`EXPO_PUBLIC_POSTHOG_KEY` overrides the default in any environment. Previews and local runs send nothing unless it is set.
Host is `https://us.i.posthog.com` (account is US). Build-time variable: redeploy after changing it.

## Events

| Event | When | Notes |
|---|---|---|
| `session_start` | once per page load | attribution properties below, `is_new_visitor` |
| `page_view` | each route change | `path` only, never a query string |
| `question_answered` | a vote is confirmed | |
| `activated` | the 3rd vote in the visitor's first session | fires once per visitor |
| `shared_link_opened`, `share_clicked`, `visitor_answered_after_link`, `visitor_shared_after_link` | share loop | |
| `paywall_viewed`, `paywall_cta_clicked`, `owner_access_*` | paywall | |

## Properties

On every event: `platform` (`web`, later `ios`), `owner_access: true` for owner/tester traffic, and the
first-touch properties `first_channel`, `first_referring_domain`, `first_utm_source`, `first_utm_medium`,
`first_utm_campaign`, `first_landing_path` (the visitor's first visit, stored in `localStorage` key
`wyr_first_touch`; falls back to this visit's values if storage is blocked).

On `session_start`: `channel`, `referrer` (origin + path only), `referring_domain`, `utm_source`, `utm_medium`,
`utm_campaign`, `landing_path` (path only).

`channel` rules (first match wins), in `lib/attribution.ts`: `link_id` → `shared_link`; known `utm_medium`
(`social`, `email`, `cpc`/`ppc`/`paid` → `paid`, `organic`) ; same-site referrer → `internal`; search engine →
`organic_search`; social site → `social`; any other referrer → `referral`; none → `direct`. iMessage and WhatsApp
send no referrer, so those arrivals are caught by `link_id`.

## Activation

Activated = **3 votes in the visitor's first session** (`lib/activation.ts`, `ACTIVATION_VOTES`). "First session"
is the tab session in which the visitor id was created. State is in `localStorage` (`wyr_activation`) so the event
fires once. Activation rate = `activated` visitors / `session_start` with `is_new_visitor = true`.

## Verify

`npm run verify:attribution` (also part of `build:web`) runs the channel, first-touch and activation cases.
In PostHog Live Events (dev project), open a Google result link, a `?utm_medium=social` link and a shared
`/p/:id?link_id=…` link and check `channel`.

## Kids pages (COPPA)

Nothing is sent to PostHog while the visitor is on a kids-bank landing page (any SEO page with a `questionTag`)
or a kids question (`/game/kf-*`, `/p/kf-*`): see `lib/kidsPaths.ts`. Votes are still stored anonymously (#65).
Consent approach for the rest of the site is still an owner decision (#51).

## Errors and bug alerts (#80)

**Client:** `lib/errorTracking.ts` (installed once from `app/_layout.tsx`) reports unhandled errors and promise
rejections, and render errors through the router's `ErrorBoundary`, as one `$exception` event each via the analytics
wrapper: `$exception_type`, `$exception_message` (scrubbed: URLs lose their query string, emails are removed,
200 characters), `$exception_source`, `path` (no query string). No stack traces. At most 2 of the same error and 10
overall per page load. Kids routes send nothing (same gate as every event). A failed vote request adds
`api_error {route: '/api/votes', kind: 'vote_failed'}`.

**API:** `api/votes.js` and `api/tallies.js` write one JSON line to stderr for every failure, including a missing
`DATABASE_URL`: `{"event":"api_error","route":"/api/votes","status":503,"reason":"…"}` (route and reason only, no ids, no
connection strings). They show up in Vercel's runtime errors/logs (`vercel logs`, or the Logs tab of the project).

**Daily report:** counts `$exception` and `api_error` events (see `docs/reports.md`).

**Spike alert (one-time setup in PostHog, not in code):** PostHog, New insight, Trends, event `$exception`, interval
hour, then the bell icon ("Alerts"), threshold above 5 per hour, notify Tim's email or Slack. Use
https://us.posthog.com/insights/new . For server errors, Vercel's own alerts can be set on the project
(Settings, Notifications), "Error anomalies". Both are one-time dashboard steps; neither was verified from code.
