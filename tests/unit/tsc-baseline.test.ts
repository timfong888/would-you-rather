import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs module
import { parseTscErrors, compareToBaseline, judge } from '../../scripts/check-tsc-baseline.mjs';

const diag = (file: string, code: string, line = 1) => `${file}(${line},1): error ${code}: something`;

test('parses one "<file> <code>" per diagnostic, not the continuation lines', () => {
  const out = [
    diag('tests/unit/a.test.ts', 'TS2304'),
    '  The last overload gave the following error.',
    "    Type 'string' is not assignable to type 'number'.",
    diag('app/b.tsx', 'TS2322', 9),
  ].join('\n');
  assert.deepEqual(parseTscErrors(out), ['tests/unit/a.test.ts TS2304', 'app/b.tsx TS2322']);
  assert.deepEqual(parseTscErrors(''), []);
});

test('a new error fails even when another baseline error was fixed (the count stays the same)', () => {
  const baseline = ['a.ts TS1', 'b.ts TS2'];
  assert.deepEqual(compareToBaseline(['a.ts TS1', 'c.ts TS3'], baseline), { added: ['c.ts TS3'], removed: ['b.ts TS2'] });
  assert.deepEqual(compareToBaseline(['a.ts TS1', 'a.ts TS1', 'b.ts TS2'], baseline).added, ['a.ts TS1'], 'one more of the same pair');
  assert.deepEqual(compareToBaseline(baseline, baseline), { added: [], removed: [] });
  assert.deepEqual(compareToBaseline(['a.ts TS1'], baseline).removed, ['b.ts TS2']);
});

test('judge: new errors fail (1), fewer pass, and a tsc that did not really run fails closed (2)', () => {
  const baseline = ['a.ts TS1'];
  assert.equal(judge({ status: 2, keys: ['a.ts TS1'] }, baseline).code, 0);
  assert.equal(judge({ status: 2, keys: ['a.ts TS1', 'b.ts TS2'] }, baseline).code, 1);
  assert.equal(judge({ status: 0, keys: [] }, baseline).code, 0, 'no errors at all is fine');
  assert.equal(judge({ status: 134, keys: [] }, baseline).code, 2, 'crash with no diagnostics: out of memory');
  assert.equal(judge({ status: 1, keys: [] }, baseline).code, 2, 'npx could not run tsc');
  assert.equal(judge({ status: null, signal: 'SIGKILL', keys: [] }, baseline).code, 2, 'killed by a signal');
  assert.equal(judge({ status: null, error: new Error('spawn'), keys: [] }, baseline).code, 2);
});

/** Runs the real script with a fake `npx` first on PATH that prints `stdout` and exits with `status`. */
function runWithFakeNpx(stdout: string, status: number) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-npx-'));
  writeFileSync(join(dir, 'npx'), `#!/bin/sh\ncat <<'EOF'\n${stdout}\nEOF\nexit ${status}\n`);
  chmodSync(join(dir, 'npx'), 0o755);
  return spawnSync('node', ['scripts/check-tsc-baseline.mjs'], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
}

test('the script: a crash exits 2, a new error exits 1, the baseline itself exits 0', () => {
  const baseline = readFileSync('scripts/tsc-baseline.txt', 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  assert.ok(baseline.length > 0);
  const asDiagnostics = baseline.map((k) => { const [file, code] = k.split(' '); return diag(file, code); });
  assert.equal(runWithFakeNpx('FATAL ERROR: Reached heap limit - JavaScript heap out of memory', 134).status, 2);
  assert.equal(runWithFakeNpx('', 1).status, 2);
  assert.equal(runWithFakeNpx(asDiagnostics.join('\n'), 2).status, 0);
  assert.equal(runWithFakeNpx([...asDiagnostics, diag('app/new.tsx', 'TS2322')].join('\n'), 2).status, 1);
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
