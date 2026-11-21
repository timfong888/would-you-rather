import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain .mjs module
import { uploadOutcome } from '../../scripts/lib/ascUploadOutcome.mjs';

test('COMPLETE is green', () => {
  const o = uploadOutcome('COMPLETE');
  assert.equal(o.exitCode, 0);
  assert.equal(o.kind, 'complete');
});

test('still PROCESSING when we stop waiting is green with a notice, not a failure', () => {
  const o = uploadOutcome('PROCESSING');
  assert.equal(o.exitCode, 0);
  assert.equal(o.kind, 'still-processing');
  assert.match(o.message, /still processing/i);
  assert.match(o.message, /not an error/i);
});

test('AWAITING_UPLOAD is treated like still processing', () => {
  assert.equal(uploadOutcome('AWAITING_UPLOAD').exitCode, 0);
});

test('FAILED stays red', () => {
  const o = uploadOutcome('FAILED');
  assert.equal(o.exitCode, 1);
  assert.equal(o.kind, 'failed');
});

test('no state at all or an unknown state stays red', () => {
  for (const s of ['UNKNOWN', '', undefined, 'SOMETHING_ELSE']) {
    const o = uploadOutcome(s);
    assert.equal(o.exitCode, 1, String(s));
    assert.equal(o.kind, 'unknown');
  }
});
