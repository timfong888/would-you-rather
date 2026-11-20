import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceWhenReady, isNotMountedError } from '../../lib/navigateWhenReady';

const NOT_MOUNTED = new Error('Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.');

function fakeScheduler() {
  const queue: Array<() => void> = [];
  return {
    queue,
    setTimeout: (fn: () => void) => { queue.push(fn); return queue.length; },
    clearTimeout: () => { queue.length = 0; },
    flush() { while (queue.length) queue.shift()!(); },
  };
}

test('navigates at once when the navigator is mounted', () => {
  const calls: string[] = [];
  replaceWhenReady({ replace: (h) => calls.push(h) }, '/unlock/high-life', { scheduler: fakeScheduler() });
  assert.deepEqual(calls, ['/unlock/high-life']);
});

test('retries while the root layout is not mounted, then navigates (cold load)', () => {
  let failsLeft = 3;
  const calls: string[] = [];
  const s = fakeScheduler();
  replaceWhenReady({ replace: (h) => { if (failsLeft-- > 0) throw NOT_MOUNTED; calls.push(h); } }, '/categories/high-life', { scheduler: s });
  assert.deepEqual(calls, []);
  s.flush();
  assert.deepEqual(calls, ['/categories/high-life']);
});

test('never throws: other errors and exhausted retries are logged, not thrown', () => {
  const origError = console.error;
  const logged: unknown[] = [];
  console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    assert.doesNotThrow(() => replaceWhenReady({ replace: () => { throw new Error('boom'); } }, '/x', { scheduler: fakeScheduler() }));
    const s = fakeScheduler();
    assert.doesNotThrow(() => { replaceWhenReady({ replace: () => { throw NOT_MOUNTED; } }, '/y', { scheduler: s, maxTries: 3 }); s.flush(); });
    assert.equal(logged.length, 2);
  } finally {
    console.error = origError;
  }
});

test('cancel stops pending retries (screen unmounted)', () => {
  const s = fakeScheduler();
  let tries = 0;
  const cancel = replaceWhenReady({ replace: () => { tries++; throw NOT_MOUNTED; } }, '/z', { scheduler: s });
  cancel();
  s.flush();
  assert.equal(tries, 1);
});

test('only the not-mounted error is treated as retryable', () => {
  assert.equal(isNotMountedError(NOT_MOUNTED), true);
  assert.equal(isNotMountedError(new Error('other')), false);
  assert.equal(isNotMountedError('Attempted to navigate before mounting the Root Layout'), false);
});

test('both gated screens navigate through replaceWhenReady, not a bare router.replace in an effect', async () => {
  const { readFileSync } = await import('node:fs');
  const game = readFileSync('app/game/[id].tsx', 'utf8');
  assert.match(game, /return replaceWhenReady\(router, `\/unlock\/\$\{category\.id\}`\);/);
  const unlock = readFileSync('app/unlock/[id].tsx', 'utf8');
  assert.match(unlock, /cancelEntryNavRef\.current = replaceWhenReady\(router, `\/categories\/\$\{id as string\}`\);/);
});
