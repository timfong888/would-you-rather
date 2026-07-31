# AI code review bots

## Triage: why CodeRabbit didn't review PR #1 but Sourcery did

[PR #1](https://github.com/timfong888/would-you-rather/pull/1) got a full Sourcery
review (a `Sourcery review` check run plus a review with 20 comments) and **zero**
activity from CodeRabbit — no check run, no comment, no "review skipped" notice.

Two independent causes, both of which have to be fixed for CodeRabbit to run:

### 1. The CodeRabbit app does not appear to be installed (needs a human)

`coderabbitai` has never commented on any pull request in any `timfong888` repo.
A configured-but-skipping CodeRabbit normally still posts a status or a skip
comment; total silence points at the GitHub App not being installed, or being
installed with **Only select repositories** access that doesn't include this one.

**Fix (requires repo admin — cannot be done from a PR):** go to
[github.com/apps/coderabbitai](https://github.com/apps/coderabbitai) → Install /
Configure → grant access to `timfong888/would-you-rather`. Confirm it appears
under repo Settings → GitHub Apps.

### 2. The PR's base branch is not the default branch

```
default branch : blocks/sat-695-create-a-web-ui-using-vercel
PR #1 base     : main
```

CodeRabbit's `reviews.auto_review.base_branches` defaults to `[]`, which means
*only the repository default branch is reviewed*. PR #1 targets `main`, which is
not the default branch, so CodeRabbit would skip it even once installed.

Sourcery has no equivalent base-branch restriction, which is exactly why one bot
reviewed and the other didn't. This is the part fixable in-repo, and
`.coderabbit.yaml` now sets `base_branches: [".*"]`.

The unusual default branch is worth fixing separately — `main` is the natural
default here, and several tools key off the default branch.

### Also relevant: drafts

CodeRabbit skips draft PRs (`auto_review.drafts` defaults to `false`). PRs opened
by agent sessions start as drafts, so this would have suppressed reviews on
future PRs regardless of the above. `.coderabbit.yaml` sets `drafts: true`.

## What `.coderabbit.yaml` does

| Setting | Why |
| --- | --- |
| `auto_review.base_branches: [".*"]` | Review PRs against any base branch, not just the default one (cause #2). |
| `auto_review.drafts: true` | Review agent-opened draft PRs. |
| `path_filters: !**/package-lock.json` | 18 of Sourcery's 20 comments on PR #1 were transitive-dependency CVEs in the lockfile. Keeps reviews on hand-written code. |
| `profile: chill` | Fewer nitpicks than `assertive`. |
| `poem: false` | Trim review boilerplate. |

All keys were validated against
[`schema.v2.json`](https://coderabbit.ai/integrations/schema.v2.json).

Note that `.coderabbit.yaml` is read **from the PR's base branch**, so it takes
effect once merged into the branches you open PRs against.
