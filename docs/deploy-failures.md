# Deploy failures: how we handle them

Plan and decisions: issue #162 (Tim, 2026-11-21). Applies to wyr first; roll out to other Vercel projects only after the end-to-end check passes.

## Rule for anyone watching a PR (child sessions)

A failed Vercel check is yours to read. Do not wait for Tim to notice.

1. **Read it yourself.** With the Vercel connector: `get_deployment` for `errorCode` and `errorMessage`, then the build events/logs. "No logs" is evidence: the build never started (provisioning stage).
2. **Your code?** If the log points at code or config in your PR, fix it, run the failing check locally, push, and show the failure and then the passing check.
3. **Known cause?** The table below only *nominates* a cause from the error text. Confirm it against the real system first (for the Neon limit: the Neon API branch count vs the limit, and failed `create_branch` operations; Vercel has no events for a provisioning failure). Confirmed: follow the action; do not change code to work around infrastructure. Not confirmed: open a `needs-rca` issue listing what you ruled out; no auto-fix.
4. **Not yours or unknown?** Report once, with the exact error text, the deployment link, the commit and what you ruled out. Do not close anything without a confirmed cause.
5. **Never** redeploy, promote or roll back production. That needs Tim's go.

## Known causes

Machine-readable copy: `.github/deploy-known-causes.json` (used by the backstop Action, #165).

| Error text (candidate) | Confirm with | Action once confirmed |
|---|---|---|
| `BUILD_FAILED: Resource provisioning failed` | Neon API: branch count at the limit (10; the project API does not expose the plan limit, so it is configured), and no failed `create_branch` operation with a different error. A limit rejection returns before an operation exists, so "no failed operation" is expected. | Run the cleanup (`Neon preview cleanup`, untick `dry_run`). Preview: the backstop Action cleans up and redeploys once per commit. Do not change code. |

Not confirmed (for example the branch count is below the limit): the error stays unexplained. Open a `needs-rca` issue with what was ruled out. Do not retry or clean up as a guess.

Add a row here, and to the JSON file (with its `confirm` check), when an RCA ends with a cause that can be recognised from the error text and checked against the real system.

## Root-cause standard (every deploy-failure issue)

Use the issue template `.github/ISSUE_TEMPLATE/deploy-failure.md`. A deploy-failure issue is closed only when all of these are filled in:

- **Symptom**: exact error text, deployment link, commit, preview or production.
- **Evidence**: log lines or API output, not guesses.
- **Why chain**: ask "why" until you reach a cause we control (failed, no DB branch, limit hit, branches never deleted on PR close, no cleanup job).
- **Fix** and **Prevention**: the change, plus the guard that stops it recurring (test, alert, workflow).
- **Known-causes entry**: the signature and fix added to the table, or "not recognisable from the error text" with the reason.

A failure with no confirmed cause stays open with what was ruled out.

## Recurrence

An automatic fix is a band-aid. If the same signature recurs 3 times in 7 days, the backstop Action opens a root-cause issue labelled `needs-rca` and stops auto-fixing that signature until the issue is closed.

## Auto-fix limits (Tim, 2026-11-21)

- Previews: auto-fix allowed, at most one retry per commit.
- Production: issue plus `needs-human`; never an automatic redeploy or rollback.
