// Regression for #186: the text that goes with a shared question is only an invitation.
// The link card already shows the question, so the text must never repeat it or state the sharer's pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shareInvite, SHARE_INVITES, __resetInviteMemory } from '../../lib/shareInvite';
import { QUESTIONS, CATEGORIES } from '../../constants/questions';
import { KIDS_QUESTIONS } from '../../constants/kidsQuestions';

const lines = Object.entries(SHARE_INVITES).filter(([k]) => k !== '_readme') as [string, string[]][];
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
// Whole-phrase match. Options under 12 characters ("Night", "Fame") are ordinary words an invitation may use.
const repeats = (text: string, option: string) => option.length >= 12 && new RegExp(`(^|\\W)${option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`).test(text);
// "I picked", "I chose", "my answer", "my take" and similar: the sharer's own pick.
const SAYS_MY_PICK = /\b(i|i've|i'd)\s+(picked|pick|chose|choose|went|voted|vote|selected)\b|\bmy\s+(pick|answer|choice|vote|take)\b|\boption [ab]\b/i;

test('every category (and a default) has a pool of 8 distinct, non-blank lines', () => {
  const ids = new Set(lines.map(([k]) => k));
  for (const c of CATEGORIES) assert.ok(ids.has(c.id), `missing pool for ${c.id}`);
  assert.ok(ids.has('default'));
  for (const [k, pool] of lines) {
    assert.equal(pool.length, 8, k);
    assert.equal(new Set(pool.map(norm)).size, pool.length, `${k} has duplicates`);
    for (const l of pool) assert.ok(l.trim().length > 0 && !l.includes('http') && !/[{}]/.test(l), `${k}: ${l}`);
  }
});

test('no invitation line states or hints at the sharer\'s pick', () => {
  for (const [k, pool] of lines) for (const l of pool) assert.ok(!SAYS_MY_PICK.test(l), `${k}: ${l}`);
});

test('share text never contains the shared question, checked against every real question', () => {
  const all = [...QUESTIONS, ...KIDS_QUESTIONS];
  assert.ok(all.length > 500, `only ${all.length} questions loaded`);
  for (const q of all) {
    const a = norm(q.optionA), b = norm(q.optionB);
    for (let r = 0; r < 8; r++) {
      const text = norm(shareInvite(q.category, () => r / 8));
      assert.ok(!repeats(text, a), `${q.id}: text contains option A`);
      assert.ok(!repeats(text, b), `${q.id}: text contains option B`);
      assert.ok(!text.includes('— or —') && !text.includes('would you rather'), `${q.id}: text restates the question`);
    }
  }
});

test('every line, against every question, never contains either option', () => {
  const opts = [...QUESTIONS, ...KIDS_QUESTIONS].flatMap((q) => [norm(q.optionA), norm(q.optionB)]);
  for (const [k, pool] of lines) for (const l of pool) for (const o of opts) assert.ok(!repeats(norm(l), o), `${k}: "${l}" contains "${o}"`);
});

test('picks from the category pool, falls back to default, never repeats back to back', () => {
  __resetInviteMemory();
  const pool = SHARE_INVITES['kids-family'];
  for (let i = 0; i < 100; i++) assert.ok(pool.includes(shareInvite('kids-family')));
  assert.ok(SHARE_INVITES.default.includes(shareInvite('not-a-category')));
  assert.ok(SHARE_INVITES.default.includes(shareInvite(undefined)));
  __resetInviteMemory();
  let prev = '';
  for (let i = 0; i < 200; i++) {
    const l = shareInvite('high-life', () => 0.5);
    assert.notEqual(l, prev);
    prev = l;
  }
  assert.equal(shareInvite('x', () => 0, { default: [] }), '');
});

test('every question share surface sends only the invitation as text', () => {
  const root = join(__dirname, '../..');
  const files = ['app/game/[id].tsx', 'app/results/[id].tsx', 'app/complete/[id].tsx', 'components/SeoLandingPage.tsx'];
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8');
    assert.match(src, /shareInvite\(/, `${f} does not use shareInvite`);
    const textLines = src.split('\n').filter((l) => /\bconst text =|runShare\(shareUrl/.test(l));
    assert.ok(textLines.length > 0, f);
    for (const l of textLines) {
      if (/shareText\(/.test(l)) continue; // match-reply lines are a separate, existing copy set
      assert.ok(!/option[AB]/.test(l), `${f}: share text built from the question: ${l.trim()}`);
      assert.ok(!SAYS_MY_PICK.test(l), `${f}: ${l.trim()}`);
    }
  }
});
