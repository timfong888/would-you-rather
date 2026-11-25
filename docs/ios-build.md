# iOS build (EAS) and TestFlight

iPhone only for v1 (`ios.supportsTablet: false`, Tim 2026-11-18): no iPad build or screenshots.

Before building for TestFlight, check the simulator smoke test on the PR: see [ios-simulator-smoke.md](ios-simulator-smoke.md) (it also lists what stays manual).

Profiles in `eas.json`:

| Profile | Use | Distribution | RevenueCat key |
|---|---|---|---|
| `development` | dev client on a registered device | internal | `test_...` Test Store |
| `development-simulator` | dev client for the iOS simulator (Mac only) | internal | `test_...` |
| `preview` | TestFlight, App Store sandbox purchases | store | `appl_...` |
| `production` | App Store | store | `appl_...` |

RevenueCat keys and any other build variables live in **EAS environment
variables** (one set per profile environment), never in the repo:

- `EXPO_PUBLIC_RC_IOS_KEY`
- Leave `EXPO_PUBLIC_OWNER_ACCESS_SHA256` unset for `preview` and `production`
  (App Store guideline 3.1.1; grant yourself access with a RevenueCat promotional
  entitlement instead).

`scripts/check-rc-keys.mjs` runs as the `eas-build-pre-install` hook and fails a
`production` build that carries a Test Store key, or a `preview` build that
does. Build numbers auto-increment (`appVersionSource: remote`).

## One-time setup (needs a person)

1. Expo access token in the agent environment (agents run builds) and the
   Apple signing login (first iOS build only, interactive).
2. `eas init` writes the EAS project id into `app.json`.
3. App Store Connect app record for `com.timfong888.wouldyourather`, Paid Apps
   agreement signed.

## Commands

```
eas build --profile development --platform ios     # dev client, Test Store
eas build --profile preview --platform ios          # TestFlight build
eas submit --profile preview --platform ios         # upload to TestFlight
```

`production` builds and `eas submit --profile production` only run on Tim's
go; submitting for review is separate and also needs his go.

## Cloud build to TestFlight without a Mac (workflow)

`.github/workflows/wyr-ios-testflight.yml` (dispatch only, by timfong888, from main) builds the app on EAS with the
`preview` profile and uploads it to TestFlight (ASC app 6836653723). One input: `wyr_sha`, a full 40-character commit
that is an ancestor of main. It uses the Actions secrets `EXPO_TOKEN` (an Expo token for the account that owns
`@blockstitch/would-you-rather`) and `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`. One run is one EAS cloud build.
The build number is whatever EAS assigns (autoIncrement); the last real TestFlight build before this was 22.
If the first run says the token is not authorized for the project, create an Expo token on the owning account and update
`EXPO_TOKEN`. Needs `EXPO_PUBLIC_RC_IOS_KEY` in the EAS `preview` environment. Apple can take 15+ minutes to process: the
run waits, and ends green with a "still processing" notice if Apple is not done; check with Apple ops "builds".
A secretless check (`scripts/wyr-check.mjs`) runs on the cloned sha before anything is installed and before the secret step; it refuses `.npmrc`, `.yarnrc*`, `app.config.*`, non-package plugins, symlinks, workspaces and non-registry dependencies or lockfile URLs, because the built sha's Expo config and plugins run with the Expo token and ASC key. eas-cli itself is installed in a neutral directory with a pinned version. Production builds are not available from this workflow.

## Build image (Xcode 26)

Apple rejects uploads built with an SDK older than iOS 26 (App Store Connect error 90725).
`eas.json` pins the iOS image `macos-sequoia-15.6-xcode-26.2` on `development`, `preview` and
`production`, and Node 20.19.4 (React Native 0.81 minimum). The app is on Expo SDK 54
(React Native 0.81, React 19, Expo Router 6); SDK 51 did not compile under Xcode 26.

## Known `npm audit` findings (Expo 54 build tooling)

`package.json` carries scoped `overrides` so `expo prebuild` works:

| Override | Why | Audit |
|---|---|---|
| `@expo/plist` -> `@xmldom/xmldom ~0.8.15` | `@expo/plist` 0.4.x needs the 0.8 `DOMParser`; 0.9+ breaks prebuild (`mimeType "undefined" is not valid`) | clean |
| `plist` -> `@xmldom/xmldom ^0.8.8` | same | clean |

The former `@expo/cli` -> `tar ^6.2.1` override is gone: CLI 54 works with tar 7, so the
critical `tar` finding is resolved (#90). `npm audit` reports no critical findings. The global
pins (`tar >=7.5.19`, `@xmldom/xmldom >=0.9.10`) still apply to every other consumer.
