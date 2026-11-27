// Requirement 6 (#277): no ad/attribution SDKs, no IDFA, no cross-app tracking.
// This test fails the build if a banned dependency or API surface is introduced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());

// ── 1. package.json must not list ad or attribution SDKs ──────────────────────
// These SDKs combine data across developers' apps for ad targeting or measurement
// (Apple tracking example 4). The list is additive; never remove an entry.
const BANNED_PACKAGES = [
  // Attribution / MMP
  'react-native-appsflyer', '@appsflyer/react-native-plugin', 'appsflyer-capacitor-plugin',
  'adjust-sdk', 'react-native-adjust', '@adjust/react-native-sdk',
  'react-native-singular-sdk', 'singular-sdk',
  'react-native-branch', 'branch-sdk',
  'react-native-kochava', 'react-native-tune',
  // Ad networks / rewarded / interstitial SDKs
  'react-native-google-ads', 'react-native-admob', '@react-native-community/google-ads',
  'react-native-mopub', 'react-native-iron-source', 'react-native-ad-manager',
  'react-native-unity-ads', 'react-native-applovin', 'react-native-mintegral',
  // Facebook / Meta (can share data with Meta ad network)
  'react-native-fbsdk', 'react-native-fbsdk-next', '@facebook/react-native-fbsdk-next',
  'react-native-facebook-ads',
  // IDFA helpers
  'react-native-idfa', 'react-native-advertising-id', '@sparkfabrik/react-native-idfa-aaid',
  'expo-tracking-transparency',
];

test('package.json has no ad, attribution or IDFA SDK dependency', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  const found = BANNED_PACKAGES.filter((name) => name in all);
  assert.deepEqual(
    found,
    [],
    `Banned ad/attribution SDK(s) found in package.json: ${found.join(', ')}. ` +
      'These SDKs combine data across developers\' apps (Apple tracking example 4). ' +
      'If a new analytics SDK is genuinely not an ad SDK, add it to the allow-list in this test with evidence.',
  );
});

// ── 2. app.json must not declare ATT / IDFA usage ─────────────────────────────
test('app.json has no NSUserTrackingUsageDescription (no ATT prompt, no IDFA)', () => {
  const appJson = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
  const infoPlist = appJson?.expo?.ios?.infoPlist ?? {};
  assert.ok(
    !('NSUserTrackingUsageDescription' in infoPlist),
    'NSUserTrackingUsageDescription is set in app.json. ' +
      'This triggers an ATT prompt and signals IDFA access to App Review. ' +
      'The privacy label must never declare IDFA use unless Tim has approved it on issue #277.',
  );
});

// ── 3. Source files must not call IDFA or ATT APIs ───────────────────────────
const BANNED_API_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /advertisingIdentifier/g, label: 'advertisingIdentifier (IDFA)' },
  { pattern: /ATTrackingManager/g, label: 'ATTrackingManager (ATT permission)' },
  { pattern: /requestTrackingAuthorization/g, label: 'requestTrackingAuthorization (ATT prompt)' },
  { pattern: /getAdvertisingId/g, label: 'getAdvertisingId (GAID on Android)' },
  { pattern: /AppTrackingTransparency/g, label: 'AppTrackingTransparency (ATT framework)' },
  { pattern: /isAdvertisingTrackingEnabled/g, label: 'isAdvertisingTrackingEnabled (deprecated IDFA flag)' },
];

const SOURCE_DIRS = ['lib', 'app', 'components', 'contexts', 'hooks', 'store', 'api', 'scripts'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      files.push(full);
    }
  }
  return files;
}

test('source files contain no IDFA or ATT API calls', () => {
  const hits: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of collectSourceFiles(join(ROOT, dir))) {
      let src: string;
      try {
        src = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const { pattern, label } of BANNED_API_PATTERNS) {
        if (pattern.test(src)) {
          hits.push(`${file.replace(ROOT + '/', '')}: ${label}`);
          pattern.lastIndex = 0;
        }
      }
    }
  }
  assert.deepEqual(
    hits,
    [],
    `Banned IDFA/ATT API call(s) found:\n${hits.join('\n')}\n\n` +
      'The app must never read the IDFA or call ATT. If the privacy label changes, ' +
      'update issue #277 first and add the identifier to the inventory comment there.',
  );
});
