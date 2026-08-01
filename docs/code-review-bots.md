# AI code review bots

## Why CodeRabbit was not reviewing PRs — issue 1 (resolved PR #4)

All times 2026-07-31 UTC. This repo's default branch is
`blocks/sat-695-create-a-web-ui-using-vercel`, not `main`.

| PR | Opened | Author | Base | Draft | CodeRabbit |
| --- | --- | --- | --- | --- | --- |
| [#1](https://github.com/timfong888/would-you-rather/pull/1) | 14:32 | `blocksorg[bot]` | `main` (not default) | no | nothing |
| [#2](https://github.com/timfong888/would-you-rather/pull/2) | 15:17 | `timfong888` | default | yes | nothing |
| [#3](https://github.com/timfong888/would-you-rather/pull/3) | 15:50 | `blocksorg[bot]` | default | no | nothing |
| [#4](https://github.com/timfong888/would-you-rather/pull/4) | 20:13 | `timfong888` | default | yes | **walkthrough + pre-merge checks + 5-comment review** |

"Nothing" means literally nothing: no check run, no comment, no review, not even
a "review skipped" notice.

**Root cause: the repository was not accessible to the CodeRabbit GitHub App
until it was added to the app's selected repositories, shortly before PR #4.**
Repository access is the confirmed root cause — PR #3 targeted the default branch,
was not a draft, and was authored the same way as PRs that are reviewed now, yet
received nothing. PR #1 and PR #2 also had independent eligibility blockers that
would have caused them to be skipped even with access: PR #1 targeted `main`
(not the default branch) and PR #2 was a draft. Being *listed* as available in
the app is not the same as being *selected*; CodeRabbit's FAQ attributes an
unreviewable repo to "the repository not being accessible to CodeRabbit."

PR #4 confirms the fix end to end. Its review reports
`Configuration used: Path: .coderabbit.yaml` and `Plan: Pro`.

## Why CodeRabbit was not reviewing PRs — issue 2 (resolved PR #10)

After PR #4 fixed repo access and config, PRs #5–#9 (all authored by
`blocksorg[bot]`) still received no CodeRabbit review. PR #9 (SAT-701) triggered
this second investigation.

| PR | Opened | Author type | Config present | CodeRabbit |
| --- | --- | --- | --- | --- |
| [#5](https://github.com/timfong888/would-you-rather/pull/5) | 20:35 | Bot | no (pre-merge) | nothing |
| [#6](https://github.com/timfong888/would-you-rather/pull/6) | 21:12 | Bot | no (pre-merge) | nothing |
| [#7](https://github.com/timfong888/would-you-rather/pull/7) | 23:15 | Bot | no (pre-merge) | nothing |
| [#8](https://github.com/timfong888/would-you-rather/pull/8) | 23:25 | Bot | no (pre-merge) | nothing |
| [#9](https://github.com/timfong888/would-you-rather/pull/9) | 23:53 | Bot | **yes** | nothing |

PR #9 is particularly diagnostic: it was opened *after* PR #4 merged, so the
config was on the default branch, the base branch was correct, and it was not a
draft — yet CodeRabbit still did not review it. A `check_suites` query showed a
`coderabbitai` suite in `queued` state with no check runs inside it, meaning
CodeRabbit received the webhook but declined to process the PR.

**Root cause: author eligibility.** `blocksorg[bot]` is a GitHub App account.
CodeRabbit requires the PR author to have either a paid seat or free-tier access.
Bot identities typically cannot hold a paid seat, and the default
`enable_free_tier` value may exclude them. The check suite is auto-created by
GitHub (not CodeRabbit), so its `queued` state is not evidence that CodeRabbit
is processing the PR — it just means the webhook arrived.

**Fix (this PR):** Two changes together solve the problem permanently:

1. `.coderabbit.yaml` gains `enable_free_tier: true` so bot-authored PRs are
   eligible for free-tier reviews without a paid seat.
2. `.github/workflows/coderabbit-bot-prs.yml` posts `@coderabbitai review`
   automatically whenever a bot opens or marks a PR ready, as a belt-and-
   suspenders fallback in case the eligibility setting alone is insufficient.

### Pre-existing PRs are not reviewed retroactively

PRs #1–#3 were opened before access was granted and will not be reviewed
automatically retroactively. To review them on demand: use `@coderabbitai review`
for an incremental review covering only new changes, or `@coderabbitai full review`
for complete coverage of the entire PR.

### `.coderabbit.yaml` applies to the PR that adds it

CodeRabbit reads `.coderabbit.yaml` from the **branch under review**, not from the
base branch — PR #4 carries the file only on its head branch and CodeRabbit still
used it. Merging it makes it the default for subsequent PRs; it does not have to
be merged to take effect on the PR introducing it.

Two settings mattered here, because both defaults are restrictive:

- `auto_review.base_branches` defaults to `[]`, meaning **only the default branch
  is auto-reviewed**. PR #1 targeted `main`, which is not the default, so it
  would have been skipped even with access. `[".*"]` opts every base branch in.
- `auto_review.drafts` defaults to `false`. Agent sessions open PRs as drafts, so
  every one of them would be skipped. PR #4 is a draft and was reviewed only
  because its own config sets `drafts: true`.

Fixing the unusual default branch (make it `main`) is still worth doing
separately; CodeRabbit and other tools key off the default branch.

### If a PR is silent again

| Comment | What it tells you |
| --- | --- |
| `@coderabbitai review` | Reviews a PR that auto-review skipped or that predates installation. |
| `@coderabbitai configuration` | Echoes the effective config, confirming whether `.coderabbit.yaml` was picked up. |
| `@coderabbitai rate limit` | Rules out hourly per-developer caps (Pro: 5 reviews/hour). |

Silence from all three *suggests* the app cannot see the repo, but it is not
proof — config, chat access controls, author eligibility, and rate limits can all
produce silence. Check the repo's CodeRabbit permissions (Settings → GitHub Apps
→ CodeRabbit) before concluding anything.

On author eligibility: CodeRabbit's FAQ says to confirm "that the author of a
pull request has an active seat." For a bot identity such as `blocksorg[bot]`,
check its seat assignment and the effective `enable_free_tier` setting — authors
without a paid seat can still receive free-tier reviews unless
`enable_free_tier` is `false`. `reviews.auto_review.ignore_usernames` is the
documented way to exclude specific authors.

## What `.coderabbit.yaml` does

| Setting | Why |
| --- | --- |
| `auto_review.base_branches: [".*"]` | Review PRs against any base branch, not just the default one. |
| `auto_review.drafts: true` | Review agent-opened draft PRs. |
| `auto_review.enable_free_tier: true` | Allow reviews for PR authors without a paid seat (e.g. `blocksorg[bot]`). Without this, bot-authored PRs are silently skipped. |
| `path_filters: ["!**/package-lock.json", "!dist/**"]` | 18 of Sourcery's 20 comments on PR #1 were transitive-dependency CVEs in the lockfile. Excludes lockfiles and build output; keeps reviews on hand-written code. |
| `profile: chill` | Fewer nitpicks than `assertive`. |
| `poem: false` | Trim review boilerplate. |

All keys were validated against
[`schema.v2.json`](https://coderabbit.ai/integrations/schema.v2.json).
