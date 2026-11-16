# Would You Rather: working agreements

Expo / React Native Web app, exported as a static site and deployed on Vercel
(production: https://www.wouldyourather.fyi). iPhone comes later.

## Tickets

- **Track work in GitHub issues in this repo.** Linear is not the tracker for now (decided 2026-11-16). Do not create or update Linear issues unless the owner asks. Older Linear ids (SAT-xxx) are references only.
- **Anything that needs the owner** (a decision, an account step, a dashboard-only change, a "do this on date X") is a GitHub issue with the **`needs-human`** label, assigned to `timfong888`. Use the issue template. State what is needed, why, the options with a recommendation, and how to close it.
- Keep one issue per decision. Close it when answered; do not leave resolved items open.

## Check-ins ("orchestrator check")

At every check-in, start with:

```
is:issue is:open label:needs-human
```

Report each open item in one line (number, title, what is needed), oldest first, flag anything with a date that has arrived, and say if the list is empty. Then look at open PRs and the latest production deploy.

## Shipping

- Merging to `main` deploys to production. **After a merge, check the production deploy** (Vercel deployment state, then the live site). A green PR preview does not prove the production build passes: Production and Preview environment variables differ.
- Keep Vercel Production and Preview env vars in step. `EXPO_PUBLIC_SITE_URL` must match the host in `public/sitemap.xml` or `generate-sharing-pages.mjs` fails the build.
- Build: `npm run build:web` (verifies data, regenerates the sitemap, exports, generates share pages, runs `verify:seo --dist`). Run it with `EXPO_PUBLIC_SITE_URL=https://www.wouldyourather.fyi` before shipping changes that touch SEO, routes or env.
- SEO details live in `docs/seo.md`. Landing pages come from `constants/seoPages.ts`.

## Code review

Greptile reviews PRs on open (`.greptile/config.json`); see `docs/code-review-bots.md`. CodeRabbit was removed on 2026-11-12. Verify a finding against the code before acting on it.

## Analytics

All events go through `lib/analytics.ts`; no SDK calls from UI code. The analytics work is tracked in issues #51 and #52.
