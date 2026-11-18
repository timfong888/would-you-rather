// Client error tracking goes through the analytics wrapper (#80): sent on adult pages,
// silent on kids routes, capped per page load, scrubbed.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { local, session, writes, go } from './_setup';
import { calls } from '../stubs/posthog';
import * as analytics from '../../lib/analytics';
import { reportError, __resetErrorTrackingForTests } from '../../lib/errorTracking';

beforeEach(() => {
  analytics.__resetForTests();
  __resetErrorTrackingForTests();
  local.clear(); session.clear(); writes.length = 0; calls.length = 0;
  go('/');
});

const exceptions = () => calls.filter((c) => c.op === 'capture' && c.args[0] === '$exception').map((c) => c.args[1] as Record<string, any>);

test('an error on an adult page is sent with type, scrubbed message, path and source', () => {
  go('/categories', '?utm_campaign=x');
  analytics.syncKidsMode('/categories');
  reportError(new TypeError('x is undefined at https://www.wouldyourather.fyi/game/hl-1?link_id=abc'), 'window.onerror');
  const [e] = exceptions();
  assert.equal(e.$exception_type, 'TypeError');
  assert.equal(e.$exception_message, 'x is undefined at https://www.wouldyourather.fyi/game/hl-1');
  assert.equal(e.$exception_source, 'window.onerror');
  assert.equal(e.path, '/categories');
  assert.ok(!JSON.stringify(e).includes('link_id'));
});

test('an error on a kids route sends nothing and writes nothing', () => {
  go('/game/kf-1');
  analytics.syncKidsMode('/game/kf-1');
  reportError(new Error('kids page broke'), 'render');
  reportError('another', 'unhandledrejection');
  assert.equal(exceptions().length, 0);
  assert.equal(calls.length, 0);
  assert.deepEqual(writes, []);
});

test('a render loop cannot flood analytics: same error at most twice, ten overall', () => {
  analytics.syncKidsMode('/');
  for (let i = 0; i < 20; i++) reportError(new Error('same'), 'render');
  assert.equal(exceptions().length, 2);
  for (let i = 0; i < 20; i++) reportError(new Error(`different ${i}`), 'render');
  assert.equal(exceptions().length, 10);
});

test('reporting never throws, even for odd values', () => {
  analytics.syncKidsMode('/');
  assert.doesNotThrow(() => {
    reportError(undefined, 'manual');
    reportError(null, 'manual');
    const cyclic: any = {}; cyclic.self = cyclic;
    reportError(cyclic, 'manual');
  });
});
