# AI code review

Greptile reviews pull requests in this repo. CodeRabbit was removed on 2026-11-12
(see [Removed: CodeRabbit](#removed-coderabbit)). Sourcery and the Blocks PR
reviewer also comment on PRs; they need no setup from this repo.

## Greptile

### When a review runs

| How | What happens |
| --- | --- |
| PR opened, reopened or marked ready | Automatic review (`autoReview: ["open"]`, the default). |
| New commits pushed | **No** review. Greptile only re-reviews pushes if `autoReview` includes `push`. |
| Comment `@greptileai review` | Reviews on demand. `@greptile review` works too. |
| Comment `@greptileai review this at apex` | One review at a higher tier. A request can raise the tier, never lower it, and applies to that review only. |
| Draft PR | Skipped by default (`triggerOnDrafts` is `false`). PRs opened as drafts, as agent sessions do, get no automatic review: mark them ready or comment. |

### What it costs

Greptile bills prepaid credits, $1 each, shared across the organization. A review
costs one credit at **Base**, three at **Plus**, ten at **Apex**; **Auto** lets
Greptile pick one of those per PR, so a large PR can cost $10 without anyone
choosing it. A TREX run adds three credits.

- The free **Starter** plan is one active developer and 50 credits a month
  (50 Base reviews, 16 Plus, or 5 Apex). **Pro** is $1 per credit with no seat fees.
- Only completed reviews spend credits, and new reviews pause when credits run out.
- Billing is per review, not per PR. The docs do not say outright that a re-triggered
  review is billed again; assume it is.
- Excluded authors are not reviewed, so they spend no credits (and do not count toward
  billing).
- Pick the tier deliberately (dashboard: Settings → Code Review → Greptile Review
  Configuration, or `effort` in `.greptile/config.json`). This repo leaves `effort`
  unset, so the dashboard setting applies.

Source: [Billing](https://www.greptile.com/docs/account/billing-seats),
[Review tiers](https://www.greptile.com/docs/code-review/review-tiers). Prices and
plan limits change; check the pricing page before relying on these numbers.

### Configuration

`.greptile/config.json` (recommended format; see the
[config reference](https://www.greptile.com/docs/code-review/greptile-config-reference)).
Greptile reads it from the PR's source branch, and it overrides dashboard settings for
the keys it sets. Precedence: `.greptile/` folder, then `greptile.json`, then the
dashboard.

This repo sets:

| Key | Value | Why |
| --- | --- | --- |
| `autoReview` | `["open"]` | The default, written down so a dashboard change cannot silently turn on a paid review per push. |
| `excludeAuthors` | `dependabot[bot]`, `renovate[bot]`, `vercel[bot]` | No credits spent on dependency bumps or Vercel's own PRs. Setting this key **replaces** Greptile's default list, which is why the two defaults are repeated. |

Agent-authored PRs (the Blocks bot) are deliberately **not** excluded: they are code
that nobody has read yet. Add `blocksorg[bot]` to `excludeAuthors` if their volume ever
makes the credits not worth it.

### Handling its findings

Verify a finding against the code before acting. Fix what is real; if a finding is
wrong, or a deliberate product choice, answer on its thread with what you traced.
(On PR #45 Greptile withdrew a finding after such a reply.) No workflow in this repo
gates on a review; if you want one required, add it as a required check in the
repository's branch protection rules.

## Other reviewers

| Reviewer | Notes |
| --- | --- |
| Sourcery | Reviews PRs automatically. `@sourcery-ai review` triggers another pass. |
| Blocks PR Review | Runs as a check on PRs. |

## Removed: CodeRabbit

CodeRabbit was removed on 2026-11-12. Deleted from the repo: `.coderabbit.yaml`,
`.github/workflows/coderabbit-trigger.yml` (posted `@coderabbitai review` with a personal
access token that had expired) and `.github/workflows/coderabbit-to-linear.yml`
(forwarded CodeRabbit's review to the Linear issue and mentioned `@blocks`).

The old setup notes and root-cause write-ups (SAT-702, SAT-727) are in git history:
`git log --follow -- docs/code-review-bots.md`.

If the Linear forwarding loop is wanted again, it would be a new workflow that matches
`greptile-apps[bot]` comments. The deleted workflow is a starting point, not a working
one: it looked issues up in Linear by `key`, which PR #33 ("key→id GraphQL bug")
describes as a bug, and that fix was never merged (the workflow's job has only ever been
skipped on recent PRs).
