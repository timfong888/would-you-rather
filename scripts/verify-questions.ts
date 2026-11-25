#!/usr/bin/env tsx
/**
 * Data integrity check for the question bank. Run: npm run verify:data
 *
 * - every question id is unique and uses its prefix: `kf-` in a kids category, `tn-` in a teen category, the category's
 *   initials in an adult one; every question belongs to exactly one existing category
 * - every kids and teen category has exactly 5 free questions by rule (its first 8 are volume 1 starters, listed first, so index gating holds)
 * - no kids or teen question matches the tone blocklist (violence, romance, brands, ...), and no two repeat
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

/** Free questions per kids and teen category (decision D2; spec §2.2). */
const KIDS_FREE_COUNT = 5;

/**
 * Tone blocklist for kids and teen questions (spec §4.3 list, applied to the written bank).
 * A deterministic first filter, not a judgement of taste: a human reads every new question.
 * `reviewed` lists ids a person has read and accepted despite a match.
 */
const BLOCKLIST: { topic: string; re: RegExp }[] = [
  { topic: 'violence or weapons', re: /\b(kill\w*|murder\w*|gun|guns|weapon\w*|knife|knives|blood\w*|bomb\w*|punch\w*|war|stab|stabs|stabbed|stabbing|shooter|shooting (at|people|him|her|them))\b/i },
  { topic: 'death', re: /\b(die|dies|died|dying|dead|death|funeral|grave)\b/i },
  { topic: 'romance or dating', re: /\b(kiss\w*|dating|date night|boyfriend|girlfriend|crush|romanc\w*|romantic|sexy|naked|valentine\w*)\b/i },
  { topic: 'substances', re: /\b(drunk|beer|wine|alcohol|vape\w*|drug\w*|cigarette\w*|smok(e|ing)|weed)\b/i },
  { topic: 'body shape or weight', re: /\b(fat|skinny|overweight|diet|ugly|chubby)\b/i },
  { topic: 'religion or politics', re: /\b(god|jesus|church|prayer|religio\w*|president|election|politic\w*|vote for)\b/i },
  { topic: 'brands or real people', re: /\b(nike|adidas|disney|pokemon|minecraft|fortnite|roblox|youtube|tiktok|instagram|snapchat|netflix|mcdonald\w*|starbucks|lego|apple watch|iphone|android)\b/i },
  { topic: 'scary themes', re: /\b(ghost\w*|monster\w*|zombie\w*|haunt\w*|nightmare\w*|creepy|scary|scared)\b/i },
  { topic: 'personal information', re: /\b(your address|phone number|password)\b/i },
];
const BLOCKLIST_REVIEWED: Record<string, string> = {
  'kf-210': 'LEGO: one existing mention, left as written (ids and text are stable); flagged in the Unit 1 PR for Tim',
};

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

async function main(): Promise<void> {

// --- ids -------------------------------------------------------------------
const seen = new Set<string>();
for (const q of QUESTIONS) {
  if (seen.has(q.id)) fail(`duplicate id ${q.id}`);
  seen.add(q.id);
  const cat = CATEGORIES.find((c) => c.id === q.category);
  if (!cat) { fail(`${q.id} belongs to "${q.category}", which is not a category`); continue; }
  const prefix = cat.audience === 'kids' ? 'kf' : cat.audience === 'teen' ? 'tn' : cat.id.split('-').map((w) => w[0]).join('');
  if (!q.id.startsWith(`${prefix}-`)) fail(`id ${q.id} does not use prefix "${prefix}-" for ${q.category} (${cat.audience})`);
  if (!q.optionA.trim() || !q.optionB.trim()) fail(`${q.id} has an empty option`);
  // Seeded counts are gone (#65): real counts come from the votes table.
  if ('votesA' in q || 'votesB' in q) fail(`${q.id} carries a seeded vote count`);
}

// --- kids and teen content ------------------------------------------------------
const seenText = new Map<string, string>();
for (const q of QUESTIONS) {
  const cat = CATEGORIES.find((c) => c.id === q.category);
  if (!cat || cat.audience === 'adult') continue;
  if (!BLOCKLIST_REVIEWED[q.id]) {
    for (const { topic, re } of BLOCKLIST) {
      const hit = `${q.optionA} | ${q.optionB}`.match(re);
      if (hit) fail(`${q.id} matches the ${topic} blocklist ("${hit[0]}"): ${q.optionA} / ${q.optionB}`);
    }
  }
  const key = [q.optionA, q.optionB].map((t) => t.toLowerCase().replace(/\s+/g, ' ').trim()).sort().join(' | ');
  const prev = seenText.get(key);
  if (prev) fail(`${q.id} repeats ${prev}`);
  seenText.set(key, q.id);
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
  if (cat.audience !== 'adult' && getFreeQuestionCount(cat) !== KIDS_FREE_COUNT) {
    fail(`category ${cat.id} has ${getFreeQuestionCount(cat)} free questions, expected ${KIDS_FREE_COUNT}`);
  }
  if (cat.audience !== 'adult' && cat.tier !== 'free') fail(`category ${cat.id}: kids and teen categories use tier "free" with volume 2 for paid questions`);
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
