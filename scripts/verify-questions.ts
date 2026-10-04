#!/usr/bin/env tsx
/**
 * Data integrity check for the question bank. Run: npm run verify:data
 *
 * - every question id is unique and uses its category's prefix
 * - every category has free content (volume 1)
 * - api/_lib/data.js (edge-function mirror) matches constants/questions.ts
 *   exactly: same ids, same order, same text, same votes, same volume
 */
import { CATEGORIES, QUESTIONS, getFreeQuestionCount } from '../constants/questions';
// The edge mirror is intentionally plain, untyped JS (it must bundle into the
// Vercel Edge runtime without TS or path aliases), so import it as-is.
// @ts-ignore
import * as mirrorModule from '../api/_lib/data.js';

type PlainQuestion = {
  id: string;
  category: string;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
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
  if (q.votesA < 0 || q.votesB < 0) fail(`${q.id} has negative votes`);
}

// --- categories --------------------------------------------------------------
for (const cat of CATEGORIES) {
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
const mirror = mirrorModule as unknown as { QUESTIONS: PlainQuestion[]; CATEGORIES: { id: string }[] };
if (mirror.QUESTIONS.length !== QUESTIONS.length) {
  fail(`api/_lib/data.js has ${mirror.QUESTIONS.length} questions, constants/questions.ts has ${QUESTIONS.length}`);
}
const n = Math.min(mirror.QUESTIONS.length, QUESTIONS.length);
for (let i = 0; i < n; i++) {
  const a = QUESTIONS[i];
  const b = mirror.QUESTIONS[i];
  const fields: (keyof PlainQuestion)[] = ['id', 'category', 'optionA', 'optionB', 'votesA', 'votesB'];
  for (const f of fields) {
    if (a[f] !== b[f]) fail(`mirror mismatch at #${i} (${a.id}) field ${f}: ts=${JSON.stringify(a[f])} js=${JSON.stringify(b[f])}`);
  }
  if ((a.volume ?? 1) !== (b.volume ?? 1)) fail(`mirror mismatch at #${i} (${a.id}) field volume`);
}
const mirrorCats = new Set(mirror.CATEGORIES.map((c) => c.id));
for (const cat of CATEGORIES) if (!mirrorCats.has(cat.id)) fail(`category ${cat.id} missing from api/_lib/data.js`);

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
