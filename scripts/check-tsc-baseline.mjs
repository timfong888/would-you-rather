#!/usr/bin/env node
/**
 * Type-check gate for CI (issue #257). Fails on any type error that is not in the checked-in baseline.
 *
 * The repo has 32 known errors, all in test code (30 in tests/unit/neville-release.test.ts, 2 in
 * tests/unit/asc-apps-list.test.ts). The baseline is the list of "<file> <TS code> <message>" keys in
 * scripts/tsc-baseline.txt, one line per error, so a new error cannot hide behind a fixed one, even one with the
 * same code in the same file: it fails when a key appears more often than the baseline allows. Line numbers are
 * left out so unrelated edits do not move it. Fewer errors than the baseline passes and says to refresh the list (`--write`).
 *
 * The gate fails closed: if tsc cannot start, is killed, or exits non-zero without printing any diagnostic
 * (out of memory, a compiler crash, npx not finding the binary), the script exits 2.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BASELINE_FILE = new URL('./tsc-baseline.txt', import.meta.url);

/** "<file> <TS code> <message>" for each `error TS` diagnostic in tsc output. Continuation lines are not counted. */
export function parseTscErrors(output) {
  const keys = [];
  for (const line of output.split('\n')) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/);
    if (m) {
      keys.push(`${m[1]} ${m[2]} ${m[3].trim()}`);
      continue;
    }
    // Global diagnostics have no location (TS2688, TS2318, TS5xxx, TS6053): count them under a placeholder file.
    const g = line.match(/^error (TS\d+): (.*)$/);
    if (g) keys.push(`<global> ${g[1]} ${g[2].trim()}`);
  }
  return keys;
}

function tally(keys) {
  const t = new Map();
  for (const k of keys) t.set(k, (t.get(k) ?? 0) + 1);
  return t;
}

/** Pairs that appear more often than the baseline allows (`added`) and fewer times (`removed`). */
export function compareToBaseline(current, baseline) {
  const cur = tally(current);
  const base = tally(baseline);
  const added = [];
  const removed = [];
  for (const [k, n] of cur) for (let i = 0; i < n - (base.get(k) ?? 0); i++) added.push(k);
  for (const [k, n] of base) for (let i = 0; i < n - (cur.get(k) ?? 0); i++) removed.push(k);
  return { added, removed };
}

/**
 * Process exit code for one tsc run: 2 = the check did not run, 1 = new errors, 0 = no new errors.
 * @param {{ status?: number | null, signal?: string | null, error?: Error, keys: string[] }} run
 * @param {string[]} baseline
 */
export function judge({ status, signal, error, keys }, baseline) {
  if (error || signal || status === null || status === undefined) return { code: 2, why: 'tsc did not finish' };
  if (status !== 0 && keys.length === 0) return { code: 2, why: `tsc exited ${status} without any diagnostic` };
  const { added, removed } = compareToBaseline(keys, baseline);
  if (added.length) return { code: 1, why: 'new type errors', added, removed };
  return { code: 0, why: removed.length ? 'fewer errors than the baseline' : 'equal to the baseline', added, removed };
}

function readBaseline() {
  return readFileSync(BASELINE_FILE, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
}

function main() {
  const r = spawnSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const keys = parseTscErrors(out);
  if (process.argv.includes('--write')) {
    // Same condition as the gate: never overwrite the baseline when tsc did not really run.
    const run = judge({ status: r.status, signal: r.signal, error: r.error, keys }, []);
    if (run.code === 2) {
      console.error(`Baseline not written: ${run.why}.`);
      process.exit(2);
    }
    writeFileSync(BASELINE_FILE, `# tsc baseline (scripts/check-tsc-baseline.mjs): one "<file> <TS code> <message>" per known error.\n${[...keys].sort().join('\n')}\n`);
    console.log(`Wrote ${keys.length} errors to scripts/tsc-baseline.txt.`);
    return;
  }
  const verdict = judge({ status: r.status, signal: r.signal, error: r.error, keys }, readBaseline());
  if (verdict.code !== 0) {
    console.error(out);
    console.error(
      verdict.code === 2
        ? `Type check did not run: ${verdict.why}.`
        : `New type errors (not in scripts/tsc-baseline.txt):\n${verdict.added.join('\n')}`,
    );
    process.exit(verdict.code);
  }
  console.log(`tsc reports ${keys.length} errors: ${verdict.why}.`);
  if (verdict.removed.length) console.log(`Refresh the list with: node scripts/check-tsc-baseline.mjs --write (${verdict.removed.length} fewer).`);
}

/** True when this file is the script node was started with: compares real paths, so spaces, symlinks and Windows paths still match. */
export function isEntryPoint(metaUrl, argv1) {
  if (!argv1) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv1);
  } catch {
    return false;
  }
}

if (isEntryPoint(import.meta.url, process.argv[1])) main();
