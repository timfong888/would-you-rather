# iOS simulator smoke test (Maestro, GitHub macOS runner)

Issue #199. Replaces "install the TestFlight build and click through it" for the basics.

Workflow: `.github/workflows/ios-simulator-smoke.yml`. Flows: `.maestro/*.yaml`.

## How it runs
1. `expo prebuild --platform ios`, then `xcodebuild -configuration Release -sdk iphonesimulator` with signing off.
   A Release build embeds the JS bundle, so no Metro server is needed.
2. Boot an iPhone simulator, install the `.app`, run every flow in `.maestro/` with Maestro (pinned version and sha256).
3. Upload screenshots, the JUnit report and the last simulator frame as the artifact `maestro-screenshots-and-report`
   (kept 14 days).

Runs on pull requests that touch app code (`app/`, `components/`, `constants/`, `contexts/`, `hooks/`, `lib/`, `store/`,
`assets/`, `app.json`, `package*.json`, `.maestro/`) and on manual dispatch (Actions tab, "iOS simulator smoke").

## What it covers
- Launch to the home screen (cold start, embedded bundle).
- Grown-ups | With kids switch, both directions.
- `/kids` renders; an age chip filters the list.
- Open a kids category, tap a locked question, and the parental gate ("Grown-ups only") appears.
  A wrong answer does not pass the gate and shows no buy button.
- Adult category (Moral Compass): tap a locked question and the paywall UI appears (fallback price, CTA, Restore).

## What it cannot cover (stays manual on a real device)
- Real purchases, sandbox purchases, Restore with an Apple ID, Ask to Buy. The CI build has **no RevenueCat key**, so
  the paywall shows the fallback price and the buy button is never tapped. A StoreKit configuration file only helps once a
  RevenueCat public key is in the build, and that is payments territory (out of scope here).
- Background and lock-screen audio, haptics, share sheets, universal links, push.
- Anything that needs the network backend (votes, results): the build points at no deployment keys.
- Real-device performance, the App Store build's signing and entitlements (this is a simulator, unsigned build).
- Whether the app is correct on the iOS version users run (the runner's default simulator only).

## Kids-route rule
No tracking and no persisted IDs on kids routes still holds: the CI build sets no analytics key (`EXPO_PUBLIC_POSTHOG_KEY`
is unset), so nothing is sent from any route. It does not replace `tests/browserless/kids-no-tracking.mjs`.

## Security
No secrets anywhere in the workflow, `permissions: contents: read`, `pull_request` only (never `pull_request_target`),
SHA-pinned actions, concurrency group, 45-minute timeout. Fork PRs can run it (public repo, no secrets exist to steal).

## Cost
Public repo: standard GitHub-hosted runners, macOS included, are free. If the repo goes private it bills the macOS
runner per minute. The figure used here is **$0.062 per minute** for the standard 3/4-core macOS runner, from the search
excerpt of GitHub's [runner pricing page](https://docs.github.com/en/billing/reference/actions-runner-pricing); the
page itself could not be opened from the build environment, and the included-minutes allowance per plan was not confirmed.
Billable minutes are rounded up per job. See the PR for the estimate per run.

## Editing a flow
Maestro matches visible text or the accessibility label, case-insensitively, as a regex. Run locally with
`maestro test .maestro/kids-smoke.yaml` against a simulator that has the app installed.
