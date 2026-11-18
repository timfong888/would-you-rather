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

## Known `npm audit` findings (Expo 51 build tooling)

`package.json` carries scoped `overrides` so `expo prebuild` works on Expo 51:

| Override | Why | Audit |
|---|---|---|
| `@expo/cli` -> `tar ^6.2.1` | `@expo/cli` needs the 6.x API; 7.x breaks prebuild | `tar` critical (advisories are 7.x ranges) |
| `@expo/plist` -> `@xmldom/xmldom ~0.8.15` | `@expo/plist` needs the 0.8 `DOMParser`; 0.9+ breaks it | clean |
| `plist` -> `@xmldom/xmldom ^0.8.8` | same | clean |

The `tar` flag stays until Expo is upgraded (`npm audit fix --force` jumps to Expo 58). It only
affects build-time tooling reading registry tarballs, not the shipped app. The global pins
(`tar >=7.5.19`, `@xmldom/xmldom >=0.9.10`) still apply to every other consumer.
