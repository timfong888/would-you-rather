# Analytics

One analytics tool: **PostHog**, behind the single wrapper `lib/analytics.ts` (UI code never calls the SDK).
With no key set nothing is sent and nothing throws.

## Key setup per environment

| Environment | `EXPO_PUBLIC_POSTHOG_KEY` |
|---|---|
| Vercel Production | the WYR production project key |
| Vercel Preview | the WYR dev project key |
| Local | leave empty, or set `EXPO_PUBLIC_ANALYTICS_DEBUG=true` to log events to the console |

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
