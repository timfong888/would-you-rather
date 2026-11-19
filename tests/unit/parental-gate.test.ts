import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, makeChallenge, requiresParentalGate } from '../../lib/parentalGate';

test('the gate applies to kids/family content only', () => {
  assert.equal(requiresParentalGate('kids-family'), true);
  assert.equal(requiresParentalGate('high-life'), false);
  assert.equal(requiresParentalGate('moral-compass'), false);
});

test('challenge is a three-number sum, not a times-table fact, with a matching answer', () => {
  for (let i = 0; i < 200; i++) {
    const c = makeChallenge();
    const parts = c.prompt.split(' + ').map(Number);
    assert.equal(parts.length, 3);
    assert.equal(parts[0] + parts[1] + parts[2], c.answer);
    assert.ok(parts[0] >= 13 && parts[1] >= 13, 'two-digit operands');
  }
});

test('challenge is deterministic for an injected random source', () => {
  assert.deepEqual(makeChallenge(() => 0), { prompt: '13 + 13 + 3', answer: 29 });
  assert.deepEqual(makeChallenge(() => 0.999999), { prompt: '39 + 39 + 9', answer: 87 });
});

test('answers: exact digits pass; blanks, wrong numbers and junk fail', () => {
  const c = { prompt: '20 + 20 + 5', answer: 45 };
  assert.equal(checkAnswer(c, '45'), true);
  assert.equal(checkAnswer(c, ' 45 '), true);
  assert.equal(checkAnswer(c, ''), false);
  assert.equal(checkAnswer(c, '46'), false);
  assert.equal(checkAnswer(c, '4 5'), false);
  assert.equal(checkAnswer(c, '45abc'), false);
  assert.equal(checkAnswer(c, '0045'), false);
});
