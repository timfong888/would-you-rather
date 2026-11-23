#!/usr/bin/env tsx
/**
 * Data integrity check for the question bank. Run: npm run verify:data
 *
 * - every question id is unique and uses its category's prefix
 * - every category has free content (volume 1)
 * - every category has an `audience` and `ages`, and they agree: audience is kids iff the youngest age is under 13
 * - api/_lib/data.js (edge-function mirror) matches constants/questions.ts
 *   exactly: same ids, same order, same text, same volume
 */
import { CATEGORIES, QUESTIONS, audienceForAges, getFreeQuestionCount } from '../constants/questions';
// The edge mirror is intentionally plain, untyped JS (it must bundle into the
// Vercel Edge runtime without TS or path aliases), so import it as-is.
// @ts-ignore
import * as mirrorModule from '../api/_lib/data.js';

type PlainQuestion = {
  id: string;
  category: string;
  optionA: string;
  optionB: string;
  volume?: number;
};

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

async function main(): Promise<void> {

// --- ids -------------------------------------------------------------------
const seen = new Set<string>();
for (const q of QUESTIONS) {
  if (seen.has(q.id)) fail(`duplicate id ${q.id}`);
  seen.add(q.id);
  const prefix = q.category.split('-').map((w) => w[0]).join('');
  if (!q.id.startsWith(`${prefix}-`)) fail(`id ${q.id} does not use prefix "${prefix}-" for ${q.category}`);
  if (!q.optionA.trim() || !q.optionB.trim()) fail(`${q.id} has an empty option`);
  // Seeded counts are gone (#65): real counts come from the votes table.
  if ('votesA' in q || 'votesB' in q) fail(`${q.id} carries a seeded vote count`);
}

// --- categories --------------------------------------------------------------
for (const cat of CATEGORIES) {
  const [min, max] = cat.ages ?? [NaN, NaN];
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) fail(`category ${cat.id} has no valid ages range`);
  else if (cat.audience !== audienceForAges(cat.ages)) {
    fail(`category ${cat.id}: audience "${cat.audience}" does not match ages ${min}–${max} (expected "${audienceForAges(cat.ages)}")`);
  }
  const qs = QUESTIONS.filter((q) => q.category === cat.id);
  if (qs.length === 0) fail(`category ${cat.id} has no questions`);
  if (getFreeQuestionCount(cat) === 0) fail(`category ${cat.id} has no free questions`);
  // Free content must come first so index-based gating works.
  const firstPaid = qs.findIndex((q) => (q.volume ?? 1) >= 2);
  if (firstPaid !== -1 && qs.slice(firstPaid).some((q) => (q.volume ?? 1) < 2)) {
    fail(`category ${cat.id}: volume-1 questions appear after expansion questions`);
  }
}

// --- edge mirror -------------------------------------------------------------
const mirror = mirrorModule as unknown as {
  QUESTIONS: PlainQuestion[];
  CATEGORIES: { id: string; audience?: string; ages?: number[] }[];
};
if (mirror.QUESTIONS.length !== QUESTIONS.length) {
  fail(`api/_lib/data.js has ${mirror.QUESTIONS.length} questions, constants/questions.ts has ${QUESTIONS.length}`);
}
const n = Math.min(mirror.QUESTIONS.length, QUESTIONS.length);
for (let i = 0; i < n; i++) {
  const a = QUESTIONS[i];
  const b = mirror.QUESTIONS[i];
  if ('votesA' in b || 'votesB' in b) fail(`api/_lib/data.js ${b.id} carries a seeded vote count`);
  const fields: (keyof PlainQuestion)[] = ['id', 'category', 'optionA', 'optionB'];
  for (const f of fields) {
    if (a[f] !== b[f]) fail(`mirror mismatch at #${i} (${a.id}) field ${f}: ts=${JSON.stringify(a[f])} js=${JSON.stringify(b[f])}`);
  }
  if ((a.volume ?? 1) !== (b.volume ?? 1)) fail(`mirror mismatch at #${i} (${a.id}) field volume`);
}
const mirrorCats = new Map(mirror.CATEGORIES.map((c) => [c.id, c]));
for (const cat of CATEGORIES) {
  const m = mirrorCats.get(cat.id);
  if (!m) { fail(`category ${cat.id} missing from api/_lib/data.js`); continue; }
  // The server decides "kids vote" from the mirror's audience, so it must match exactly.
  if (m.audience !== cat.audience) fail(`mirror mismatch for category ${cat.id}: audience ts=${cat.audience} js=${m.audience}`);
  if (m.ages?.[0] !== cat.ages[0] || m.ages?.[1] !== cat.ages[1]) fail(`mirror mismatch for category ${cat.id}: ages ts=${cat.ages} js=${m.ages}`);
}

if (errors.length) {
  console.error(`verify-questions: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`verify-questions: OK — ${QUESTIONS.length} questions across ${CATEGORIES.length} categories, edge mirror in sync`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
