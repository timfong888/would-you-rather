# Reports (daily and weekly SEO)

Two plain-text reports for a scheduled task to run and push to Tim's phone. There is no scheduler in this repo.

```
npx tsx scripts/report.ts daily    # visits by source, activation, errors (last 24 h)
npx tsx scripts/report.ts seo      # sitemap status, indexed pages, top queries: Google and Bing (weekly)
```

A section whose credential is missing prints `not configured: <KEY>` and the command still exits 0, so
the report always arrives and says what to set up. Run `npm test` for the fixture-based tests.

## Credentials (secrets in the scheduled task's environment, never in the repo)

| Report | Variable | What it is and where to create it |
|---|---|---|
| daily | `POSTHOG_PERSONAL_API_KEY` | A PostHog **personal API key** with the "Query: read" scope (not the public `phc_` project token). PostHog, your avatar, Personal API keys: https://us.posthog.com/settings/user-api-keys |
| daily | `POSTHOG_PROJECT_ID` | The numeric project ID: PostHog, Project settings, "Project ID": https://us.posthog.com/settings/project#variables |
| seo | `GSC_SERVICE_ACCOUNT_JSON` | The full JSON key of a Google Cloud service account that has been added as a **Restricted** user on the Search Console property `wouldyourather.fyi` (Search Console, Settings, Users and permissions). Enable the "Google Search Console API" in that cloud project. |
| seo | `GSC_SITE_URL` (optional) | Property id; defaults to `sc-domain:wouldyourather.fyi`. |
| seo | `BING_WEBMASTER_API_KEY` | Bing Webmaster Tools, Settings, API access, "API key": https://www.bing.com/webmasters (URL of the API access page not verified; the site must be added and verified in Bing Webmaster Tools first, for example by importing it from Search Console). |

## What each line means

- **Visits**: `session_start` events in the last 24 hours, by `channel` (see `docs/analytics.md`), owner/tester traffic excluded.
- **Activated**: `activated` events (3 votes in a visitor's first session) over new visitors (`is_new_visitor`).
- **Errors**: `$exception` and `api_error` events (unit #80). Server-side errors are also visible in Vercel runtime errors.
- **Google sitemaps**: submitted sitemaps with errors/warnings and URLs submitted. Google no longer reports an
  indexed count per sitemap, so **Google indexed** inspects the home page, categories and every landing page with the URL Inspection API (quota: 2,000 per day) and counts verdict `PASS`.
- **Top queries**: last 7 days, by impressions.
- **Bing**: sitemap status (`GetFeeds`), indexed pages from the latest `GetCrawlStats`, top queries (`GetQueryStats`).

## Verification status

Tested against fixture responses only. The live Google and Bing endpoints and the PostHog query API were not called
(no credentials in the build environment): the first run with real credentials is the real test.
