// #119: the in-app version text is built from the installed binary's values. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatVersion } from '../../lib/version';

test('formatVersion shows version and build number', () => {
  assert.equal(formatVersion('1.0.0', '8'), 'Version 1.0.0 (8)');
  assert.equal(formatVersion(' 1.0.0 ', ' 9 '), 'Version 1.0.0 (9)');
});

test('formatVersion never invents a version', () => {
  assert.equal(formatVersion(null, '8'), 'Version unknown');
  assert.equal(formatVersion(undefined, undefined), 'Version unknown');
  assert.equal(formatVersion('', ''), 'Version unknown');
  assert.equal(formatVersion('1.0.0', null), 'Version 1.0.0');
});

test('no screen hardcodes a version string; both read the native binary', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
  for (const f of ['app/settings.tsx', 'app/index.tsx']) {
    const src = read(f);
    assert.ok(/<VersionText\b/.test(src), `${f} must render <VersionText>`);
    assert.ok(!/['"`]1\.0\.0['"`]|expoConfig\??\.version/.test(src), `${f} must not hardcode or read the config version`);
  }
  const comp = read('components/VersionText.tsx');
  assert.ok(/nativeApplicationVersion/.test(comp) && /nativeBuildVersion/.test(comp));
  assert.ok(/Platform\.OS === 'web'\) return null/.test(comp), 'web must render nothing');
});
