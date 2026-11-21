import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeployEnv, webFreeUnlockAllowed } from '../../lib/testUnlockPolicy';

test('preview and development parse as themselves', () => {
  assert.equal(parseDeployEnv('preview'), 'preview');
  assert.equal(parseDeployEnv('development'), 'development');
});

test('an unknown or missing deploy env is treated as production (fail closed)', () => {
  for (const env of [undefined, null, '', 'prod', 'Preview', 'staging']) {
    assert.equal(parseDeployEnv(env), 'production');
  }
});

test('the temporary web free unlock: web only, flag exactly "1" (Tim, 2026-11-21, "128 b")', () => {
  assert.equal(webFreeUnlockAllowed('1', 'web'), true);
  for (const flag of ['0', 'true', '', ' 1', undefined, null]) assert.equal(webFreeUnlockAllowed(flag, 'web'), false);
  for (const platform of ['ios', 'android', '']) assert.equal(webFreeUnlockAllowed('1', platform), false);
});
