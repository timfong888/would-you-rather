#!/usr/bin/env bash
# Build the iOS app on this Mac and upload it straight to TestFlight (no EAS cloud queue).
#
#   scripts/ios-local.sh              # build (preview profile) and upload
#   scripts/ios-local.sh --dry-run    # check the setup and print the plan, change nothing
#   scripts/ios-local.sh --skip-upload  # build build.ipa only
#   PROFILE=production scripts/ios-local.sh   # production profile (only with an explicit go)
#
# Needs: macOS, Xcode, CocoaPods, fastlane, Node 20+, eas-cli logged in, and the App Store
# Connect API key file. See docs/ios-local-build.md for the one-time setup.
#
# The .p8 key is read from ~/.appstoreconnect/private_keys/ by `xcrun altool`. It is never
# copied, printed, or committed. The key id and issuer id below are identifiers, not secrets.
set -euo pipefail

ASC_KEY_ID="${ASC_KEY_ID:-XNJ7P44VR8}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-fdddb19e-f1ba-4bf9-94cf-6fe46ee043ce}"
KEY_FILE="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
PROFILE="${PROFILE:-preview}"
OUTPUT="build.ipa"

DRY_RUN=0
SKIP_UPLOAD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-upload) SKIP_UPLOAD=1 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "ERROR: $*" >&2; exit 1; }
ok()   { echo "ok   $*"; }

cd "$(dirname "$0")/.."

echo "== Checking this Mac =="
[ "$(uname -s)" = "Darwin" ] || fail "iOS builds need macOS."
xcode-select -p >/dev/null 2>&1 || fail "Xcode command line tools missing. Run: xcode-select --install"
command -v xcodebuild >/dev/null || fail "Xcode missing. Install it from the Mac App Store: https://apps.apple.com/app/xcode/id497799835"
xcodebuild -version >/dev/null 2>&1 || fail "Xcode is not ready. Open Xcode once and accept the license, or run: sudo xcodebuild -license accept"
ok "Xcode $(xcodebuild -version | head -1)"
command -v node >/dev/null || fail "Node missing. Install Node 20: https://nodejs.org"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node 20+ needed (found $(node -v))."
ok "Node $(node -v)"
command -v pod >/dev/null || fail "CocoaPods missing. Run: brew install cocoapods"
ok "CocoaPods $(pod --version)"
command -v fastlane >/dev/null || fail "fastlane missing (EAS local builds need it). Run: brew install fastlane"
ok "fastlane"
command -v eas >/dev/null || fail "eas-cli missing. Run: npm install -g eas-cli"
EAS_USER="$(eas whoami 2>/dev/null | head -1 || true)"
[ -n "$EAS_USER" ] && [ "$EAS_USER" != "Not logged in" ] || fail "Not logged in to Expo. Run: eas login"
ok "eas-cli logged in as $EAS_USER"
if [ "$SKIP_UPLOAD" -eq 0 ]; then
  [ -f "$KEY_FILE" ] || fail "App Store Connect key not found at $KEY_FILE
  Put AuthKey_${ASC_KEY_ID}.p8 there (mkdir -p ~/.appstoreconnect/private_keys; chmod 600 on the file)."
  [ "$(stat -f '%Lp' "$KEY_FILE")" = "600" ] || fail "Run: chmod 600 $KEY_FILE"
  ok "App Store Connect key present (contents not read by this script)"
fi
[ -z "$(git status --porcelain)" ] || echo "warn working tree has uncommitted changes; they will be in this build"
ok "profile: $PROFILE"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "Dry run: setup looks fine. A real run would:"
  echo "  1. eas build --platform ios --profile $PROFILE --local --non-interactive --output $OUTPUT"
  echo "     (build number auto-increments through EAS: appVersionSource=remote, autoIncrement=true)"
  [ "$SKIP_UPLOAD" -eq 1 ] || echo "  2. xcrun altool --upload-app -f $OUTPUT -t ios --apiKey $ASC_KEY_ID --apiIssuer $ASC_ISSUER_ID"
  exit 0
fi

echo
echo "== Building ($PROFILE, local) =="
rm -f "$OUTPUT"
eas build --platform ios --profile "$PROFILE" --local --non-interactive --output "$OUTPUT"
[ -f "$OUTPUT" ] || fail "Build finished but $OUTPUT was not created."

VERSION="$(unzip -p "$OUTPUT" 'Payload/*.app/Info.plist' | plutil -extract CFBundleShortVersionString raw -o - - 2>/dev/null || echo '?')"
BUILD="$(unzip -p "$OUTPUT" 'Payload/*.app/Info.plist' | plutil -extract CFBundleVersion raw -o - - 2>/dev/null || echo '?')"
echo "Built $OUTPUT: version $VERSION, build $BUILD"

if [ "$SKIP_UPLOAD" -eq 1 ]; then
  echo "Skipping upload (--skip-upload). IPA: $PWD/$OUTPUT"
  exit 0
fi

echo
echo "== Uploading to App Store Connect =="
xcrun altool --upload-app -f "$OUTPUT" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
echo
echo "Uploaded version $VERSION build $BUILD. Apple processes it for a few minutes (up to ~30),"
echo "then it appears in TestFlight: https://appstoreconnect.apple.com/apps/6836653723/testflight/ios"
echo "If it never appears, check the Apple ID email for 'issues with your recent delivery'."
