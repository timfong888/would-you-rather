import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePick, decodePick, decodeFriend, matchOutcome, pickLine, shareText, matchEvent, headingFor,
  MATCH_COPY, __resetLineMemory,
} from '../../lib/matchShare';
import { buildShareLink } from '../../lib/shareQuestion';

test('encodePick/decodePick round-trip for both picks, across random fills', () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(decodePick(encodePick('A')), 'A');
    assert.equal(decodePick(encodePick('B')), 'B');
  }
});

test('the code does not spell the pick', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(!/^[ab]$/i.test(encodePick('A')) && encodePick('A').length === 3);
    assert.notEqual(encodePick('A').toUpperCase(), 'A');
  }
});

test('decodePick ignores missing, wrong-length and tampered codes', () => {
  for (const bad of [undefined, null, '', 'A', 'B', 'ab', 'abcd', '???', '2$2', 'zzz', 123, ['2k2']]) {
    assert.equal(decodePick(bad as unknown), null, String(bad));
  }
});

test('matchOutcome', () => {
  assert.equal(matchOutcome('A', 'A'), 'matched');
  assert.equal(matchOutcome('B', 'B'), 'matched');
  assert.equal(matchOutcome('A', 'B'), 'different');
  assert.equal(matchOutcome('B', 'A'), 'different');
});

test('line pools: sizes, no blanks, no duplicates', () => {
  assert.equal(MATCH_COPY.adult.matched.length, 10);
  assert.equal(MATCH_COPY.adult.different.length, 10);
  assert.equal(MATCH_COPY.kids.matched.length, 6);
  assert.equal(MATCH_COPY.kids.different.length, 6);
  for (const pool of [MATCH_COPY.adult.matched, MATCH_COPY.adult.different, MATCH_COPY.kids.matched, MATCH_COPY.kids.different]) {
    assert.ok(pool.every((l) => l.trim().length > 0));
    assert.equal(new Set(pool).size, pool.length);
  }
});

test('pickLine returns a line from the right pool and never repeats back to back', () => {
  __resetLineMemory();
  for (const kids of [false, true]) {
    for (const outcome of ['matched', 'different'] as const) {
      const pool = MATCH_COPY[kids ? 'kids' : 'adult'][outcome];
      let prev = '';
      for (let i = 0; i < 100; i++) {
        const line = pickLine(kids, outcome);
        assert.ok(pool.includes(line));
        assert.notEqual(line, prev);
        prev = line;
      }
    }
  }
});

test('pickLine with a fixed random source still avoids an immediate repeat', () => {
  __resetLineMemory();
  const a = pickLine(false, 'matched', () => 0);
  const b = pickLine(false, 'matched', () => 0);
  assert.notEqual(a, b);
});

test('share text fills {line}; kids text is the approved kid-safe message', () => {
  assert.equal(shareText(false, 'tell_matched', 'Same brain, apparently.'), 'Plot twist: we matched. Same brain, apparently.');
  assert.equal(shareText(false, 'tell_different', 'Appeal denied.'), 'We picked differently. Appeal denied.');
  assert.equal(shareText(true, 'tell_matched', 'Same pick!'), 'I picked an answer. Which would you pick?');
  assert.equal(shareText(true, 'ask_another'), 'I picked an answer. Which would you pick?');
  assert.ok(!shareText(true, 'first_after').includes('{line}'));
});

test('headings', () => {
  assert.equal(headingFor(false, 'matched'), 'You matched the person who sent this');
  assert.equal(headingFor(false, 'different'), 'You and the person who sent this picked differently');
});

test('share link carries the sharer pick as f=<code>, adult and kids', () => {
  const o = 'https://www.wouldyourather.fyi';
  const adult = buildShareLink({ origin: o, questionId: 'sb-1', linkId: 'L', generation: 1, kids: false, friendPick: 'B' });
  const u = new URL(adult);
  assert.equal(u.pathname, '/p/sb-1');
  assert.equal(u.searchParams.get('link_id'), 'L');
  assert.equal(decodePick(u.searchParams.get('f')), 'B');
  const kids = new URL(buildShareLink({ origin: o, questionId: 'kf-2', linkId: '', generation: 1, kids: true, friendPick: 'A' }));
  assert.deepEqual([...kids.searchParams.keys()], ['f']);
  assert.equal(decodePick(kids.searchParams.get('f')), 'A');
  // Before answering there is no pick: the link is unchanged.
  assert.equal(buildShareLink({ origin: o, questionId: 'kf-2', linkId: '', generation: 1, kids: true, friendPick: null }), `${o}/p/kf-2`);
});

test('the preview text and card never carry the pick', () => {
  for (const kids of [false, true]) {
    for (const key of ['first_after', 'first_before', 'tell_matched', 'tell_different', 'ask_another'] as const) {
      assert.ok(!/\b(option )?[AB]\b picked|I picked [AB]\b/.test(shareText(kids, key, 'x')));
    }
  }
});

test('analytics: kids routes send no match events; adult events carry only whether it matched', () => {
  for (const kind of ['opened', 'answered', 'reply_sent'] as const) {
    assert.deepEqual(matchEvent(kind, { kids: true, questionId: 'kf-2', visitorId: 'v', outcome: 'matched' }), []);
  }
  const ans = matchEvent('answered', { kids: false, questionId: 'sb-1', visitorId: 'v', outcome: 'different' });
  assert.deepEqual(ans.map((e) => e.name), ['share_answered']);
  assert.equal(ans[0].props.matched, false);
  assert.ok(!JSON.stringify(ans).includes('"A"') && !JSON.stringify(ans).includes('"B"'));
  assert.deepEqual(matchEvent('opened', { kids: false, questionId: 'sb-1', visitorId: 'v' }).map((e) => e.name), ['share_opened']);
  assert.deepEqual(matchEvent('reply_sent', { kids: false, questionId: 'sb-1', visitorId: 'v', outcome: 'matched' }).map((e) => e.name), ['share_reply_sent']);
});

test('an "ask" code (a share made before answering) is told apart from both picks', () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(decodeFriend(encodePick('ask')), 'ask');
    assert.equal(decodePick(encodePick('ask')), null);
    assert.equal(decodeFriend(encodePick('A')), 'A');
    assert.equal(decodeFriend(encodePick('B')), 'B');
  }
  assert.equal(decodeFriend('zzz'), null);
  assert.equal(decodeFriend(undefined), null);
});

test('before-answering share links carry an ask code, kids included (no link_id on kids)', () => {
  const o = 'https://www.wouldyourather.fyi';
  const kids = new URL(buildShareLink({ origin: o, questionId: 'kf-2', linkId: '', generation: 1, kids: true, friendPick: 'ask' }));
  assert.deepEqual([...kids.searchParams.keys()], ['f']);
  assert.equal(decodeFriend(kids.searchParams.get('f')), 'ask');
});

test('the "asked" heading and tell_asked text exist for adult and kids', () => {
  assert.ok(headingFor(false, 'asked').length > 0);
  assert.ok(headingFor(true, 'asked').length > 0);
  assert.ok(shareText(false, 'tell_asked').length > 0);
  assert.equal(shareText(true, 'tell_asked'), 'I picked an answer. Which would you pick?');
});
