#!/usr/bin/env tsx
/**
 * Generates public/sitemap.xml from the static categories and questions data.
 * Run: npm run generate:sitemap
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIES, QUESTIONS } from '../constants/questions';
import { SITE_URL } from '../constants/config';

const TODAY = new Date().toISOString().split('T')[0];

function url(loc: string, priority: string, changefreq = 'monthly'): string {
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

for (const cat of CATEGORIES) {
  urls.push(url(`/categories/${cat.id}`, '0.8'));
}

// One entry per real question id, in category order (covers expansion packs too).
for (const cat of CATEGORIES) {
  for (const q of QUESTIONS.filter((x) => x.category === cat.id)) {
    urls.push(url(`/game/${q.id}`, '0.6'));
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

const outPath = resolve(process.cwd(), 'public/sitemap.xml');
writeFileSync(outPath, xml, 'utf-8');
console.log(`Sitemap written to ${outPath} (${urls.length} URLs)`);
