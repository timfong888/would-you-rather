#!/usr/bin/env tsx
/**
 * Generates public/sitemap.xml from the static categories and questions data.
 * Run: npm run generate:sitemap
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CATEGORIES, TOTAL_QUESTIONS_PER_CATEGORY } from '../constants/questions';
import { SITE_URL } from '../constants/config';

const TODAY = new Date().toISOString().split('T')[0];

function categoryPrefix(id: string): string {
  return id.split('-').map((w) => w[0]).join('');
}

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

for (const cat of CATEGORIES) {
  const prefix = categoryPrefix(cat.id);
  for (let i = 1; i <= TOTAL_QUESTIONS_PER_CATEGORY; i++) {
    urls.push(url(`/game/${prefix}-${i}`, '0.6'));
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
