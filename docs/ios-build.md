# iOS build (EAS) and TestFlight

iPhone only for v1 (`ios.supportsTablet: false`, Tim 2026-11-18): no iPad build or screenshots.

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
