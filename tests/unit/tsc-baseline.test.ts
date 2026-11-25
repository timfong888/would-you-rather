import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
// @ts-ignore plain .mjs module
import { parseTscErrors, compareToBaseline, judge, isEntryPoint } from '../../scripts/check-tsc-baseline.mjs';

const diag = (file: string, code: string, line = 1, msg = 'something') => `${file}(${line},1): error ${code}: ${msg}`;

test('parses one "<file> <code>" per diagnostic, not the continuation lines', () => {
  const out = [
    diag('tests/unit/a.test.ts', 'TS2304'),
    '  The last overload gave the following error.',
    "    Type 'string' is not assignable to type 'number'.",
    diag('app/b.tsx', 'TS2322', 9),
  ].join('\n');
  assert.deepEqual(parseTscErrors(out), ['tests/unit/a.test.ts TS2304 something', 'app/b.tsx TS2322 something']);
  assert.deepEqual(parseTscErrors(''), []);
});

test('replacing an error with a different one of the same code in the same file fails (P1 on #258)', () => {
  const baseline = parseTscErrors([diag('t.ts', 'TS2345', 3, "Argument of type 'a' is not assignable"), diag('t.ts', 'TS2345', 9, "Argument of type 'b' is not assignable")].join('\n'));
  const replaced = parseTscErrors([diag('t.ts', 'TS2345', 3, "Argument of type 'a' is not assignable"), diag('t.ts', 'TS2345', 9, "Argument of type 'c' is not assignable")].join('\n'));
  assert.equal(judge({ status: 2, keys: replaced }, baseline).code, 1);
  // The same errors on other lines (unrelated edits move them) still pass.
  const moved = parseTscErrors([diag('t.ts', 'TS2345', 30, "Argument of type 'a' is not assignable"), diag('t.ts', 'TS2345', 90, "Argument of type 'b' is not assignable")].join('\n'));
  assert.equal(judge({ status: 2, keys: moved }, baseline).code, 0);
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
function runWithFakeNpx(stdout: string, status: number, script = 'scripts/check-tsc-baseline.mjs', args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-npx-'));
  writeFileSync(join(dir, 'npx'), `#!/bin/sh\ncat <<'EOF'\n${stdout}\nEOF\nexit ${status}\n`);
  chmodSync(join(dir, 'npx'), 0o755);
  return spawnSync('node', [script, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
}

test('global diagnostics with no file location count as errors (P2 on #258)', () => {
  const out = [diag('a.ts', 'TS1'), "error TS2688: Cannot find type definition file for 'node'."].join('\n');
  assert.deepEqual(parseTscErrors(out), ['a.ts TS1 something', '<global> TS2688 Cannot find type definition file for \'node\'.']);
  assert.equal(judge({ status: 2, keys: parseTscErrors(out) }, ['a.ts TS1 something']).code, 1);
  assert.equal(judge({ status: 2, keys: parseTscErrors("error TS2688: x") }, []).code, 1, 'only a global error still fails');
});

test('the entry-point check matches through a symlink and a path with a space (P2 on #258)', () => {
  assert.equal(isEntryPoint(pathToFileURL(resolve('scripts/check-tsc-baseline.mjs')).href, resolve('scripts/check-tsc-baseline.mjs')), true);
  assert.equal(isEntryPoint(pathToFileURL(resolve('scripts/check-tsc-baseline.mjs')).href, resolve('scripts/other.mjs')), false);
  assert.equal(isEntryPoint(pathToFileURL(resolve('scripts/check-tsc-baseline.mjs')).href, undefined), false);
  const dir = mkdtempSync(join(tmpdir(), 'gate test '));
  const link = join(dir, 'gate.mjs');
  symlinkSync(resolve('scripts/check-tsc-baseline.mjs'), link);
  // A crashing tsc must still exit 2 when the script is started by a path with a space and a symlink.
  assert.equal(runWithFakeNpx('', 1, link).status, 2);
});

test('--write does not overwrite the baseline when tsc did not really run (P3 on #258)', () => {
  const before = readFileSync('scripts/tsc-baseline.txt', 'utf8');
  assert.equal(runWithFakeNpx('', 1, 'scripts/check-tsc-baseline.mjs', ['--write']).status, 2);
  assert.equal(runWithFakeNpx('FATAL ERROR: heap out of memory', 134, 'scripts/check-tsc-baseline.mjs', ['--write']).status, 2);
  assert.equal(readFileSync('scripts/tsc-baseline.txt', 'utf8'), before);
});

test('the script: a crash exits 2, a new error exits 1, the baseline itself exits 0', () => {
  const baseline = readFileSync('scripts/tsc-baseline.txt', 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  assert.ok(baseline.length > 0);
  const asDiagnostics = baseline.map((k) => { const [file, code, ...msg] = k.split(' '); return diag(file, code, 1, msg.join(' ')); });
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
