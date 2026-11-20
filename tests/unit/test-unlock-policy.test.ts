import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeployEnv, testUnlockAllowed } from '../../lib/testUnlockPolicy';

test('production never allows the free test unlock, whatever the flag', () => {
  for (const flag of ['1', 'true', 'yes', '', undefined]) assert.equal(testUnlockAllowed('production', flag, 'web'), false);
});

test('preview and development allow it only with the flag set to exactly "1"', () => {
  for (const env of ['preview', 'development']) {
    assert.equal(testUnlockAllowed(env, '1', 'web'), true);
    for (const flag of ['0', 'true', '', ' 1', undefined, null]) assert.equal(testUnlockAllowed(env, flag, 'web'), false);
  }
});

test('an unknown or missing deploy env is treated as production (fail closed)', () => {
  for (const env of [undefined, null, '', 'prod', 'Preview', 'staging']) {
    assert.equal(parseDeployEnv(env), 'production');
    assert.equal(testUnlockAllowed(env, '1', 'web'), false);
  }
});

test('iOS and Android never allow it, whatever the env and flag (Tim, 2026-11-20, decision A)', () => {
  for (const platform of ['ios', 'android', '']) {
    for (const env of ['preview', 'development', 'production']) assert.equal(testUnlockAllowed(env, '1', platform), false);
  }
});
