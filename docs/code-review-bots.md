# AI code review bots

## Triage: CodeRabbit reviews nothing in this repo, Sourcery reviews everything

Observed on every pull request opened so far:

| PR | Author | Base branch | Sourcery | CodeRabbit |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/timfong888/would-you-rather/pull/1) | `blocksorg[bot]` | `main` | check run + review (20 comments) | nothing |
| [#2](https://github.com/timfong888/would-you-rather/pull/2) | `timfong888` | `blocks/sat-695-…` | — | nothing |
| [#3](https://github.com/timfong888/would-you-rather/pull/3) | `blocksorg[bot]` | `blocks/sat-695-…` | check run + review (2 issues) | nothing |

"Nothing" means literally nothing: no check run, no comment, no review, and no
"review skipped" notice. That distinction matters — the filters CodeRabbit
documents (base branch, drafts, labels, title keywords) make it skip *quietly*,
but the app still has to be reachable for the skip to happen at all.

### The base-branch filter cannot be the whole story

`reviews.auto_review.base_branches` defaults to `[]`, which means **only the
repository default branch is auto-reviewed**. This repo has an unusual default
branch (`blocks/sat-695-create-a-web-ui-using-vercel`, not `main`), and the PRs
above are split across two different base branches — so whichever branch is the
real default, at least one of these PRs targeted it and should still have been
reviewed. Something upstream of the per-PR filters is suppressing all of them.

### Ranked causes and how to confirm each (needs a human — not fixable from a PR)

1. **The repo is not actually granted to the CodeRabbit app.** Being *listed* in
   the app's repository picker is not the same as being *selected*. Verify at
   repo Settings → GitHub Apps → CodeRabbit; the repo must appear there. Per
   CodeRabbit's FAQ, an unreviewable repo "is likely due to the repository not
   being accessible to CodeRabbit."
2. **The PR author has no CodeRabbit seat.** The FAQ explicitly says to confirm
   "that the author of a pull request has an active seat in CodeRabbit." PRs #1
   and #3 are authored by `blocksorg[bot]`, a GitHub App — it can never hold a
   seat. If seat enforcement is what's biting, agent-opened PRs will need a
   manual `@coderabbitai review` (or a CodeRabbit org setting that allows
   bot-authored PRs).
3. **Base branch / drafts filters.** Real, and the part fixable in-repo:
   `.coderabbit.yaml` sets `base_branches: [".*"]` and `drafts: true`.
4. **Config not live yet.** `.coderabbit.yaml` is read from the PR's *base*
   branch, so it does nothing until it is merged into the branches PRs target.
   This is why nothing changed between the first triage (PR #2, still open) and
   PR #3 — the config has never been on a base branch.

Fixing the unusual default branch (make it `main`) is worth doing separately;
CodeRabbit and other tools key off the default branch.

### Diagnostics to run as PR comments

Post these on an open PR — **any** response at all proves the app is installed
and can see the repo, which is the one thing that can't be checked from inside
the repo:

| Comment | What it tells you |
| --- | --- |
| `@coderabbitai review` | Triggers a review of a PR that auto-review skipped or that predates installation. |
| `@coderabbitai configuration` | Echoes the effective config, confirming whether `.coderabbit.yaml` was picked up. |
| `@coderabbitai rate limit` | Rules out hourly per-developer caps (Pro: 5 reviews/hour). |

Silence from all three means the app cannot see the repo — go back to cause #1.

## What `.coderabbit.yaml` does

| Setting | Why |
| --- | --- |
| `auto_review.base_branches: [".*"]` | Review PRs against any base branch, not just the default one (cause #3). |
| `auto_review.drafts: true` | Review agent-opened draft PRs. |
| `path_filters: !**/package-lock.json` | 18 of Sourcery's 20 comments on PR #1 were transitive-dependency CVEs in the lockfile. Keeps reviews on hand-written code. |
| `profile: chill` | Fewer nitpicks than `assertive`. |
| `poem: false` | Trim review boilerplate. |

All keys were validated against
[`schema.v2.json`](https://coderabbit.ai/integrations/schema.v2.json).
