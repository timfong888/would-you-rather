import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativePathFor } from '../../lib/universalLink';

const lookup = (id: string) => (id === 'kf-17' ? { category: 'kids-family' } : id === 'cc-1' ? { category: 'career-climber' } : undefined);

test('a share link maps to the game screen, keeping f, link_id and gen', () => {
  assert.equal(
    nativePathFor('https://www.wouldyourather.fyi/p/cc-1?link_id=L&gen=2&f=2a3&utm_x=1', lookup),
    '/game/cc-1?cat=career-climber&f=2a3&link_id=L&gen=2',
  );
  assert.equal(nativePathFor('/p/kf-17?f=2b3', lookup), '/game/kf-17?cat=kids-family&f=2b3');
  assert.equal(nativePathFor('would-you-rather:///p/kf-17', lookup), '/game/kf-17?cat=kids-family');
});

test('unknown or excluded questions open home; other paths pass through', () => {
  assert.equal(nativePathFor('https://www.wouldyourather.fyi/p/ms-1', lookup), '/');
  assert.equal(nativePathFor('/game/cc-1?cat=career-climber', lookup), '/game/cc-1?cat=career-climber');
  assert.equal(nativePathFor('/', lookup), '/');
});

test('AASA file and associated domain agree on app, domain and paths', () => {
  const aasa = JSON.parse(readFileSync('public/.well-known/apple-app-site-association', 'utf8'));
  const d = aasa.applinks.details[0];
  assert.deepEqual(d.appIDs, ['VJKU43W3C2.com.timfong888.wouldyourather']);
  assert.deepEqual(d.paths, ['/p/*']);
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  assert.equal(app.ios.bundleIdentifier, 'com.timfong888.wouldyourather');
  assert.deepEqual(app.ios.associatedDomains, ['applinks:www.wouldyourather.fyi']);
});

test('vercel serves the AASA as JSON', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const h = v.headers.find((x: { source: string }) => x.source === '/.well-known/apple-app-site-association');
  assert.ok(h.headers.some((x: { key: string; value: string }) => x.key.toLowerCase() === 'content-type' && x.value === 'application/json'));
});
