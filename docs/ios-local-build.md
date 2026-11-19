# Build iOS on your Mac and upload to TestFlight

> **Blocked until the Expo SDK upgrade (#90).** Apple now rejects builds made with an SDK older
> than iOS 26 (App Store Connect error 90725, needs Xcode 26+), and the app's current Expo SDK 51 /
> React Native 0.74 does not compile under Xcode 26 (`cannot find 'TARGET_IPHONE_SIMULATOR' in
> scope`). This script works as designed, but its build step will fail until the app is on Expo
> SDK 54 or newer. Details: https://github.com/timfong888/would-you-rather/issues/75

One command builds the app locally and uploads it straight to App Store Connect, so
you skip the EAS cloud build and submit queues (the Free plan queue can take hours).

```
scripts/ios-local.sh --dry-run   # check your setup first, changes nothing
scripts/ios-local.sh             # build (preview profile) and upload to TestFlight
```

Options: `--skip-upload` builds `build.ipa` only. `PROFILE=production scripts/ios-local.sh`
uses the production profile; only do that with an explicit go (see `docs/ios-build.md`).

The script checks everything below and tells you what is missing.

## One-time setup (about 45 minutes, mostly downloads)

Do these in order on the MacBook.

1. **Xcode** (large download). Install from the Mac App Store:
   https://apps.apple.com/app/xcode/id497799835 , then open it once and accept the license
   (or run `sudo xcodebuild -license accept`).
2. **Command line tools**: `xcode-select --install`
3. **Homebrew** (if you do not have it): https://brew.sh
4. **Node 20 or newer**: `brew install node@20` or the installer at https://nodejs.org
5. **CocoaPods and fastlane** (EAS local builds need both):
   `brew install cocoapods fastlane`
6. **eas-cli**: `npm install -g eas-cli`
7. **Log in to Expo**: `eas login` (account `blockstitch`, project
   `@blockstitch/would-you-rather`). Signing certificate and provisioning profile are
   already stored in EAS; the local build downloads them, so you do not touch Xcode signing.
8. **App Store Connect API key file** (this is the only secret on your Mac). Put the `.p8`
   file you downloaded when you created the key `XNJ7P44VR8` here:
   ```
   mkdir -p ~/.appstoreconnect/private_keys
   mv ~/Downloads/AuthKey_XNJ7P44VR8.p8 ~/.appstoreconnect/private_keys/
   chmod 600 ~/.appstoreconnect/private_keys/AuthKey_XNJ7P44VR8.p8
   ```
   Apple only lets you download a key once. If the file is gone, create a new key at
   https://appstoreconnect.apple.com/access/integrations/api (role **App Manager**) and
   update `ASC_KEY_ID` when you run the script (`ASC_KEY_ID=NEWID scripts/ios-local.sh`).
9. **Clone this repo and install**: `git clone https://github.com/timfong888/would-you-rather`,
   `cd would-you-rather`, `npm install`.

Key id `XNJ7P44VR8` and issuer id `fdddb19e-f1ba-4bf9-94cf-6fe46ee043ce` are identifiers, not
secrets, and are the defaults in the script. The `.p8` is never read by the script, copied, or
committed (`.gitignore` blocks `*.p8`, `AuthKey_*`, `private_keys/` and `*.ipa`).

## What the script does

1. Checks Xcode, Node, CocoaPods, fastlane, eas-cli login, the key file.
2. `eas build --platform ios --profile preview --local --non-interactive --output build.ipa`.
   The build number is bumped for you through EAS (`appVersionSource: remote` with
   `autoIncrement: true`), so local and cloud builds never reuse a number. Do not edit
   `buildNumber` in `app.json`; it is ignored.
3. Reads the version and build number out of `build.ipa` and prints them.
4. `xcrun altool --upload-app -f build.ipa -t ios --apiKey XNJ7P44VR8 --apiIssuer <issuer>`.

## After the upload

- Apple processes the build for a few minutes (occasionally up to 30). It then appears at
  https://appstoreconnect.apple.com/apps/6836653723/testflight/ios and can be added to the
  internal testing group.
- If it never appears, Apple emailed the account holder an "issues with your recent
  delivery" message with the exact reason. Send it to the team.
- Environment variables: the `preview` profile reads EAS environment variables for the
  `preview` environment. Variables marked *secret* in EAS are not available to local builds;
  `EXPO_PUBLIC_*` values are public anyway, so keep them as plain text or sensitive.

## Troubleshooting

| Message | Fix |
|---|---|
| `Not logged in to Expo` | `eas login` |
| `Run: chmod 600 ...` | `chmod 600 ~/.appstoreconnect/private_keys/AuthKey_XNJ7P44VR8.p8` |
| `xcodebuild -license` error | `sudo xcodebuild -license accept` |
| `pod: command not found` | `brew install cocoapods` |
| altool says the key is invalid | key id, issuer id or role (needs App Manager) is wrong; recreate at the link above |
| Build fails on `check-rc-keys` | a `test_` RevenueCat key is set for the `preview` or `production` environment; see `docs/ios-build.md` |

Alternative upload: if `altool` ever stops working, open the free **Transporter** app
(https://apps.apple.com/app/transporter/id1450874784), sign in, and drag `build.ipa` in.
