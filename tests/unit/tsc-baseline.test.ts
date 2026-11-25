import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { countTscErrors, judge, TSC_ERROR_BASELINE } from '../../scripts/check-tsc-baseline.mjs';

test('counts error diagnostics, not their continuation lines', () => {
  const out = [
    "tests/unit/a.test.ts(1,1): error TS2304: Cannot find name 'x'.",
    '  The last overload gave the following error.',
    "    Type 'string' is not assignable to type 'number'.",
    "app/b.tsx(3,9): error TS2322: Type 'a' is not assignable to type 'b'.",
  ].join('\n');
  assert.equal(countTscErrors(out), 2);
  assert.equal(countTscErrors(''), 0);
});

test('above the baseline fails, equal passes, below asks to lower it', () => {
  assert.equal(judge(TSC_ERROR_BASELINE + 1), 'fail');
  assert.equal(judge(TSC_ERROR_BASELINE), 'ok');
  assert.equal(judge(TSC_ERROR_BASELINE - 1), 'lower');
  assert.equal(TSC_ERROR_BASELINE, 32);
});

test('the unit workflow is a pull_request job named unit that runs npm test and the baseline check, with no secrets', () => {
  const wf = readFileSync('.github/workflows/unit.yml', 'utf8');
  assert.match(wf, /\n  pull_request:/);
  assert.doesNotMatch(wf, /pull_request_target/);
  assert.doesNotMatch(wf, /pull_request:\s*\n\s*paths/, 'no path filter, so the check always reports');
  assert.match(wf, /\n  unit:\n    name: unit\n/);
  assert.match(wf, /node-version: 22/, 'the suite fails on Node 20');
  assert.match(wf, /run: npm ci/);
  assert.match(wf, /run: npm test/);
  assert.match(wf, /run: node scripts\/check-tsc-baseline\.mjs/);
  assert.doesNotMatch(wf, /secrets\./);
  assert.match(wf, /permissions:\s*\n\s*contents: read/);
});
