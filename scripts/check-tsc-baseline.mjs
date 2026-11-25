#!/usr/bin/env node
/**
 * Fails when `tsc --noEmit` reports more type errors than the baseline (issue #257).
 *
 * The repo has 32 known errors, all in test code (30 in tests/unit/neville-release.test.ts, 2 in
 * tests/unit/asc-apps-list.test.ts). A new error must not hide among them, so CI compares the count.
 * Fewer errors than the baseline passes and prints the new number so the baseline can be lowered here.
 */
import { spawnSync } from 'node:child_process';

export const TSC_ERROR_BASELINE = 32;

/** Number of `error TS` diagnostics in tsc output. Continuation lines of a diagnostic are not counted. */
export function countTscErrors(output) {
  return output.split('\n').filter((line) => /error TS\d+:/.test(line)).length;
}

/** 'fail' above the baseline, 'lower' below it (lower the baseline), 'ok' at it. */
export function judge(count, baseline = TSC_ERROR_BASELINE) {
  return count > baseline ? 'fail' : count < baseline ? 'lower' : 'ok';
}

function main() {
  const r = spawnSync('npx', ['tsc', '--noEmit'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.error) {
    console.error(`Could not run tsc: ${r.error.message}`);
    process.exit(2);
  }
  const count = countTscErrors(out);
  const verdict = judge(count);
  if (verdict === 'fail') {
    console.error(out);
    console.error(`tsc reports ${count} errors; the baseline is ${TSC_ERROR_BASELINE}. Fix the new type errors.`);
    process.exit(1);
  }
  if (verdict === 'lower') console.log(`tsc reports ${count} errors, below the baseline of ${TSC_ERROR_BASELINE}. Lower TSC_ERROR_BASELINE in scripts/check-tsc-baseline.mjs to ${count}.`);
  else console.log(`tsc reports ${count} errors, equal to the baseline.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
