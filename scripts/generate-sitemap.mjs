#!/usr/bin/env node
/**
 * Generates public/sitemap.xml from the static categories and questions data.
 * Run: node scripts/generate-sitemap.mjs
 * Update SITE_URL below (or EXPO_PUBLIC_SITE_URL env var) once the domain is confirmed.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://wouldyourather.vercel.app';
const TODAY = new Date().toISOString().split('T')[0];

// ---------------------------------------------------------------------------
// Static data (mirrors constants/questions.ts — keep in sync)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'high-life',
  'moral-compass',
  'midnight-secrets',
  'social-blunders',
  'time-traveler',
  'deep-desires',
  'career-climber',
  'tech-dystopia',
  'wildest-dreams',
];

const QUESTION_PREFIXES = {
  'high-life': 'hl',
  'moral-compass': 'mc',
  'midnight-secrets': 'ms',
  'social-blunders': 'sb',
  'time-traveler': 'tt',
  'deep-desires': 'dd',
  'career-climber': 'cc',
  'tech-dystopia': 'td',
  'wildest-dreams': 'wd',
};

const QUESTIONS_PER_CATEGORY = 20;

// ---------------------------------------------------------------------------
// Build URL list
// ---------------------------------------------------------------------------

function url(loc, priority, changefreq = 'monthly') {
  return `  <url>
    <loc>${SITE_URL}${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

const urls = [
  url('/', '1.0', 'weekly'),
  url('/categories', '0.9', 'weekly'),
];

for (const catId of CATEGORIES) {
  urls.push(url(`/categories/${catId}`, '0.8'));
}

for (const catId of CATEGORIES) {
  const prefix = QUESTION_PREFIXES[catId];
  for (let i = 1; i <= QUESTIONS_PER_CATEGORY; i++) {
    urls.push(url(`/game/${prefix}-${i}`, '0.6'));
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

const outPath = resolve(__dirname, '../public/sitemap.xml');
writeFileSync(outPath, xml, 'utf-8');
console.log(`Sitemap written to ${outPath} (${urls.length} URLs)`);
