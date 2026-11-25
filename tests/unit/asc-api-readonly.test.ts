import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const ACTIONS = ['app', 'builds', 'prerelease', 'uploads', 'bundle-ids', 'iap', 'build-icon', 'versions', 'iap-images', 'iap-screenshots'];

function run(action: string) {
  const log = join(mkdtempSync(join(tmpdir(), 'asc-')), 'req.log');
  const r = spawnSync(process.execPath, ['--import', './tests/fixtures/asc-fetch-stub.mjs', 'scripts/asc-api.mjs', action, '--app', '6836653723'], {
    env: { PATH: process.env.PATH, ASC_KEY_ID: 'K', ASC_ISSUER_ID: 'I', ASC_PRIVATE_KEY: pem, ASC_STUB_LOG: log },
    encoding: 'utf8',
  });
  let calls: { url: string; method: string; hasBody: boolean }[] = [];
  try { calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* no calls */ }
  return { r, calls };
}

for (const action of ACTIONS) {
  test(`asc-api ${action}: only GET requests, no body, exits 0`, () => {
    const { r, calls } = run(action);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(calls.length >= 1);
    for (const c of calls) {
      assert.equal(c.method, 'GET');
      assert.equal(c.hasBody, false);
      assert.ok(c.url.startsWith('https://api.appstoreconnect.apple.com/'));
    }
  });
}

test('asc-api source has a single fetch call and no write verbs', () => {
  const src = readFileSync('scripts/asc-api.mjs', 'utf8');
  assert.equal((src.match(/fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(src, /method\s*:|POST|PATCH|PUT|DELETE/);
});

test('asc-api build-icon hides the icon URL and shows presence and size', () => {
  const { r } = run('build-icon');
  assert.match(r.stdout, /"present": true/);
  assert.match(r.stdout, /"width": 1024/);
  assert.doesNotMatch(r.stdout, /mzstatic|secret-token/);
});

test('asc-api iap-images hides URLs and prints the product id per IAP', () => {
  const { r, calls } = run('iap-images');
  assert.match(r.stdout, /--- p1 \(READY_TO_SUBMIT\)/);
  assert.doesNotMatch(r.stdout, /token=abc|x\.test/);
  assert.ok(calls.some((c) => c.url.includes('/v2/inAppPurchases/111/images')));
});

test('asc-api iap-screenshots queries each IAP review screenshot', () => {
  const { calls } = run('iap-screenshots');
  assert.ok(calls.some((c) => c.url.includes('/v2/inAppPurchases/111/appStoreReviewScreenshot')));
});

test('apple-ops workflow lists every new action', () => {
  const wf = readFileSync('.github/workflows/apple-ops.yml', 'utf8');
  for (const a of ['build-icon', 'versions', 'iap-images', 'iap-screenshots']) assert.match(wf, new RegExp(`- ${a}\\n`));
});
