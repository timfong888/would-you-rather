// #229: the message that goes with a shared question is exactly "Which would you pick?", everywhere.
// The link card shows the question and the pick travels in the link, so the body never repeats either.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHARE_PROMPT } from '../../lib/shareInvite';
import { SHARE_TITLE, sharePageMeta } from '../../lib/sharePage';
import { buildShareLink } from '../../lib/shareQuestion';
import { decodePick } from '../../lib/matchShare';
import { QUESTIONS } from '../../constants/questions';
import { KIDS_QUESTIONS } from '../../constants/kidsQuestions';
import { CANONICAL_ORIGIN } from '../../lib/site';

const root = join(__dirname, '../..');
const SURFACES = ['app/game/[id].tsx', 'app/results/[id].tsx', 'app/complete/[id].tsx', 'components/SeoLandingPage.tsx'];

test('the share body is exactly "Which would you pick?"', () => {
  assert.equal(SHARE_PROMPT, 'Which would you pick?');
});

test('og:title (and twitter:title) is the same words as the body', () => {
  assert.equal(SHARE_TITLE, SHARE_PROMPT);
  for (const q of [...QUESTIONS, ...KIDS_QUESTIONS].slice(0, 50)) {
    assert.equal(sharePageMeta(q, CANONICAL_ORIGIN).title, SHARE_PROMPT, q.id);
  }
});

test('every question share surface sends only SHARE_PROMPT as the message text', () => {
  for (const f of SURFACES) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.match(src, /SHARE_PROMPT/, `${f} does not use SHARE_PROMPT`);
    assert.ok(!/shareInvite\(/.test(src), `${f} still builds an invite line`);
    // Every `text` handed to a share API is SHARE_PROMPT, except the match reply (shareText) and the TikTok caption.
    const textLines = src.split('\n').filter((l) => /\bconst text =|runShare\(\w+, /.test(l));
    assert.ok(textLines.length > 0, f);
    for (const l of textLines) {
      if (/shareText\(/.test(l)) continue; // "Tell them" reply: separate existing copy set
      if (/hashtags/.test(l)) continue; // TikTok caption keeps the question (no link card there)
      assert.ok(/SHARE_PROMPT/.test(l), `${f}: ${l.trim()}`);
      assert.ok(!/option[AB]/.test(l), `${f}: ${l.trim()}`);
    }
  }
});

test('no question text in any share body except the TikTok caption', () => {
  for (const f of SURFACES) {
    const src = readFileSync(join(root, f), 'utf8');
    const withQuestion = src.split('\n').filter((l) => /(const text =|text:).*option[AB]/.test(l));
    for (const l of withQuestion) assert.ok(/hashtags/.test(l), `${f}: ${l.trim()}`);
  }
});

test('adult links carry link_id, gen and the pick as f; kids links carry no link_id or gen (only f once answered)', () => {
  const adult = new URL(buildShareLink({ origin: CANONICAL_ORIGIN, questionId: 'hl-1', linkId: 'ab12cd34', generation: 1, kids: false, friendPick: 'B' }));
  assert.deepEqual([...adult.searchParams.keys()], ['link_id', 'gen', 'f']);
  assert.equal(decodePick(adult.searchParams.get('f')), 'B');
  const kidsAsked = buildShareLink({ origin: CANONICAL_ORIGIN, questionId: 'kf-29', linkId: 'ab12cd34', generation: 1, kids: true, friendPick: null });
  assert.equal(kidsAsked, `${CANONICAL_ORIGIN}/p/kf-29`);
  const kids = new URL(buildShareLink({ origin: CANONICAL_ORIGIN, questionId: 'kf-29', linkId: 'ab12cd34', generation: 1, kids: true, friendPick: 'A' }));
  assert.deepEqual([...kids.searchParams.keys()], ['f']);
});
