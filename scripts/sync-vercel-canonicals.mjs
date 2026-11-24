/**
 * Keeps the canonical for the playable /game/<id> page in the server response (docs/specs/seo-question-pages.md, #206).
 * The exported app shell is one static file for every question, so a canonical tag set by the app only exists after
 * the page renders. For the questions that have a read-only page (lib/seoBatch.js) this adds an HTTP header
 * `Link: <https://.../q/<id>>; rel="canonical"` to /game/<id> in vercel.json, which crawlers read without running scripts.
 *
 *   node scripts/sync-vercel-canonicals.mjs          rewrite vercel.json
 *   node scripts/sync-vercel-canonicals.mjs --check  exit 1 if vercel.json is out of date (used by tests and verify-seo)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '../vercel.json');
const { CANONICAL_ORIGIN } = await import('../lib/site.js');
const { SEO_QUESTION_PAGES } = await import('../lib/seoBatch.js');

export const canonicalHeaders = () =>
  SEO_QUESTION_PAGES.map((id) => ({
    source: `/game/${id}`,
    headers: [{ key: 'Link', value: `<${CANONICAL_ORIGIN}/q/${id}>; rel="canonical"` }],
  }));

const text = readFileSync(FILE, 'utf8');
const config = JSON.parse(text);
const isCanonicalRule = (h) => /^\/game\/[^/:]+$/.test(h.source) && h.headers?.some((x) => x.key === 'Link');
const current = config.headers.filter(isCanonicalRule);
const wanted = canonicalHeaders();
const same = JSON.stringify(current) === JSON.stringify(wanted);
if (process.argv.includes('--check')) {
  if (!same) {
    console.error('vercel.json canonical headers are out of date: run `node scripts/sync-vercel-canonicals.mjs`');
    process.exit(1);
  }
} else if (!same) {
  // Edit the text, not the parsed object, so the rest of the file keeps its formatting.
  const rule = (h) => `    { "source": "${h.source}", "headers": [{ "key": "Link", "value": ${JSON.stringify(h.headers[0].value)} }] }`;
  const stripped = text.replace(/^ *\{ "source": "\/game\/[^"]+", "headers": \[\{ "key": "Link".*\n/gm, '').replace(/\},\n\s*\],\n  "redirects"/, '}\n  ],\n  "redirects"');
  const anchor = '"headers": [{ "key": "Content-Type", "value": "application/json" }]\n    }';
  if (!stripped.includes(anchor)) throw new Error('sync-vercel-canonicals: cannot find the apple-app-site-association header rule');
  const out = stripped.replace(anchor, anchor + ',\n' + wanted.map(rule).join(',\n'));
  JSON.parse(out);
  writeFileSync(FILE, out);
  console.log(`vercel.json: ${wanted.length} /game/<id> canonical headers`);
}
