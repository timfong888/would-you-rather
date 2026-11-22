// #188: only someone who opens the shared link in the app and answers sees the sender's pick.
// The preview card, the share text and the page the link opens never carry it in the clear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildShareLink } from '../../lib/shareQuestion';
import { decodePick } from '../../lib/matchShare';

const root = join(__dirname, '../..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const ORIGIN = 'https://www.wouldyourather.fyi';

test('the card endpoint does not read a pick or label one', () => {
  const src = read('api/card.js');
  assert.ok(!/searchParams\.get\(["']voted["']\)/.test(src), 'api/card.js still reads voted');
  assert.ok(!/MY CHOICE|isMyTakeMode|I'm with the|I'm in the/.test(src), 'api/card.js still renders a pick');
});

test('no share URL puts the pick in a plain voted= parameter', () => {
  for (const f of ['app/results/[id].tsx', 'app/complete/[id].tsx', 'app/game/[id].tsx', 'components/SeoLandingPage.tsx']) {
    const bad = read(f).split('\n').filter((l) => /voted=/.test(l) && /(share|myTake|base)Url|replyUrl/i.test(l));
    assert.deepEqual(bad, [], `${f}: ${bad.join(' | ')}`);
  }
});

test('the share page keeps the pick out of the card image and forwards only the obfuscated code', () => {
  const gen = read('scripts/generate-sharing-pages.mjs');
  assert.ok(!/voted/.test(gen), 'sharing pages reference voted');
  assert.ok(/searchParams\.set\('f'/.test(gen));
});

test('a share link carries the pick only as the f code, never as A or B in the clear', () => {
  for (const pick of ['A', 'B'] as const) {
    const url = new URL(buildShareLink({ origin: ORIGIN, questionId: 'hl-5', linkId: 'x', generation: 1, kids: false, friendPick: pick }));
    assert.equal(url.searchParams.get('voted'), null);
    assert.equal(decodePick(url.searchParams.get('f')), pick);
    assert.notEqual(url.searchParams.get('f'), pick);
    assert.ok(!url.pathname.includes(pick) || url.pathname === '/p/hl-5');
  }
});
