# AI code review bots

## Triage: CodeRabbit reviews nothing in this repo, Sourcery reviews everything

Observed on every pull request opened so far:

This repo's default branch is **`blocks/sat-695-create-a-web-ui-using-vercel`**,
not `main` (`origin/HEAD` confirms it). That matters for every row below.

| PR | Author | Base branch | Draft | Sourcery | CodeRabbit |
| --- | --- | --- | --- | --- | --- |
| [#1](https://github.com/timfong888/would-you-rather/pull/1) | `blocksorg[bot]` | `main` (not default) | no | check run + review (20 comments) | nothing |
| [#2](https://github.com/timfong888/would-you-rather/pull/2) | `timfong888` | default | **yes** | — | nothing |
| [#3](https://github.com/timfong888/would-you-rather/pull/3) | `blocksorg[bot]` | default | no | check run + review (2 issues) | nothing |
| [#4](https://github.com/timfong888/would-you-rather/pull/4) | `timfong888` | default | **yes** | — | nothing |

"Nothing" means literally nothing: no check run, no comment, no review, and no
"review skipped" notice — which is expected, because CodeRabbit's documented
filters skip *silently*.

### Only PR #3 is unexplained

Three of the four rows are CodeRabbit behaving exactly as documented:

- **#1** targeted `main`, which is *not* the default branch.
  `reviews.auto_review.base_branches` defaults to `[]`, meaning only the default
  branch is auto-reviewed. Skipping #1 was correct.
- **#2 and #4** are drafts, and `auto_review.drafts` defaults to `false`.

**PR #3 is the decisive case**: default base branch, not a draft, and the repo is
visible in the CodeRabbit GitHub App. Nothing in the documented filter set
accounts for it. Its only remaining difference from a PR that should be reviewed
is that `blocksorg[bot]` — a GitHub App — opened it.

### Ranked causes and how to confirm each (needs a human — not fixable from a PR)

1. **The PR author has no CodeRabbit seat.** The FAQ says to confirm "that the
   author of a pull request has an active seat in CodeRabbit." A GitHub App can
   never hold one, and this is the cause that explains PR #3 when the filters do
   not. If it is the blocker, agent-opened PRs need a manual
   `@coderabbitai review` or a CodeRabbit org setting that permits bot-authored
   PRs.
2. **The app is listed but not receiving events for this repo.** Appearing in the
   app's repository picker is not the same as being *selected*; the FAQ
   attributes an unreviewable repo to "the repository not being accessible to
   CodeRabbit." Confirm at repo Settings → GitHub Apps → CodeRabbit. A reply to
   any `@coderabbitai` command is the real proof that events land.
3. **Base branch / drafts filters.** These explain #1, #2 and #4, and are the
   part fixable in-repo: `.coderabbit.yaml` sets `base_branches: [".*"]` and
   `drafts: true`.
4. **Config not live yet.** `.coderabbit.yaml` is read from the PR's *base*
   branch, so it does nothing until merged into the branches PRs target. This is
   why nothing changed between the first triage (PR #2, still open) and PR #3 —
   the config has never been on a base branch.

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

Silence from all three means the app cannot see the repo — go back to cause #2.
A reply plus a review on PR #3 means auto-review is the only thing broken, which
points at cause #1.

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
