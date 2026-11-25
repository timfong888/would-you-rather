import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// #246: every workflow that reads the App Store Connect key names the apple-ops environment
// (restricted to main in repository settings), so the key cannot be read from a branch.

const dir = '.github/workflows';
const keyHolders = readdirSync(dir)
  .filter((f) => f.endsWith('.yml'))
  .filter((f) => /secrets\.ASC_PRIVATE_KEY/.test(readFileSync(`${dir}/${f}`, 'utf8')));

test('the eleven known key-holding workflows are found', () => {
  assert.deepEqual(keyHolders, [
    'apple-apps-list.yml',
    'apple-iap-create.yml',
    'apple-iap-review-screenshot.yml',
    'apple-iap-update.yml',
    'apple-metadata.yml',
    'apple-ops.yml',
    'apple-testflight-group.yml',
    'apple-upload.yml',
    'highersignal-ios-testflight.yml',
    'neville-ios-testflight.yml',
    'wyr-ios-testflight.yml',
  ]);
});

test('every workflow that reads ASC_PRIVATE_KEY names environment: apple-ops on that job', () => {
  for (const f of keyHolders) {
    const text = readFileSync(`${dir}/${f}`, 'utf8');
    assert.equal((text.match(/^    environment: apple-ops$/gm) ?? []).length, 1, f);
    const jobs = text.split(/^jobs:\n/m)[1] ?? '';
    const header = jobs.split(/^    steps:/m)[0];
    assert.match(header, /^    environment: apple-ops$/m, `${f}: environment is on the job that holds the key`);
  }
});
