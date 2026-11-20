/**
 * SAT-741: Generate static HTML sharing pages for all questions.
 *
 * /api/p/[id].jsx was never built by Vercel (the `.jsx` extension is not a function
 * entry, #73; plain `.js` files in api/ do deploy) and has been removed. This script generates
 * individual static HTML files in dist/p/{id}.html at build time so that
 * /p/:id resolves to a real file with full OG meta tags and a JS redirect.
 *
 * The vercel.json rewrite `/p/:id` → `/p/:id.html` serves these files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { CANONICAL_ORIGIN } = await import('../lib/site.js');
const { sharePageMeta } = await import('../lib/sharePage.js');
const { QUESTIONS, CATEGORIES, THEME_FOR_CATEGORY } =
  await import('../api/_lib/data.js');

// Same value the app uses for share links (constants/config.ts SITE_URL): CANONICAL_ORIGIN, unless a
// non-production build sets EXPO_PUBLIC_SITE_URL (local browserless checks, previews). A production
// build must use the canonical origin, or share links and og:url would disagree with the real domain.
// Never use VERCEL_URL here — it is per-deployment and causes link rot.
const BASE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, '');
if (process.env.VERCEL_ENV === 'production' && BASE_URL !== CANONICAL_ORIGIN) {
  console.error(`generate-sharing-pages: production build with EXPO_PUBLIC_SITE_URL="${BASE_URL}", expected CANONICAL_ORIGIN "${CANONICAL_ORIGIN}" (lib/site.js).`);
  process.exit(1);
}

// Build-time guard: og:url host must match every host in sitemap.xml.
const sitemapXml = await readFile(join(__dirname, '../public/sitemap.xml'), 'utf-8');
const sitemapLocs = [...sitemapXml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/g)].map(([, loc]) => loc);
if (sitemapLocs.length === 0) {
  console.error('generate-sharing-pages: could not find a <loc> URL in public/sitemap.xml');
  process.exit(1);
}
const baseUrlHost = new URL(BASE_URL).host;
const mismatchedLoc = sitemapLocs.find((loc) => new URL(loc).host !== baseUrlHost);
if (mismatchedLoc) {
  console.error(
    `generate-sharing-pages: host mismatch — BASE_URL "${baseUrlHost}" ≠ sitemap.xml entry "${mismatchedLoc}". ` +
    `Set EXPO_PUBLIC_SITE_URL to match, or regenerate sitemap.xml first.`
  );
  process.exit(1);
}
const OUT_DIR = join(__dirname, '../dist/p');

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

await mkdir(OUT_DIR, { recursive: true });

let count = 0;
for (const question of QUESTIONS) {
  const { id } = question;
  const category = CATEGORIES.find(c => c.id === question.category);
  const themeName = THEME_FOR_CATEGORY[question.category] || 'bright';
  const isMoody = themeName === 'moody';

  // Build-time pages never carry vote numbers (#65) and the OG image (/api/og) is static
  // brand + options only: no votes, IDs or records, so kids questions are safe too.
  const meta = sharePageMeta(question, BASE_URL);
  const ogTitle = meta.title;
  const ogDescription = meta.description;
  const shareUrl = meta.url;
  const cardUrl = meta.image;
  const appUrl = `${BASE_URL}/game/${id}?cat=${encodeURIComponent(question.category)}`;

  const displayOptA = truncate(question.optionA, 200);
  const displayOptB = truncate(question.optionB, 200);
  const catEmoji = category ? category.emoji : '🎲';
  const catLabel = category ? category.label : 'Would You Rather';

  const bgColor = isMoody ? '#0D0D1A' : '#F5E6F0';
  const cardBg = isMoody ? '#1C0D30' : '#FFFFFF';
  const textCol = isMoody ? '#FFFFFF' : '#1A1A2E';
  const mutedCol = isMoody ? 'rgba(255,255,255,0.5)' : '#9090A8';
  const ctaCol = isMoody ? '#C9A84C' : '#D63384';
  const ctaText = isMoody ? '#0D0D1A' : '#FFFFFF';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(ogTitle)}</title>
  <meta name="description" content="${esc(ogDescription)}" />
  <link rel="icon" href="${BASE_URL}/favicon.ico" />
  <link rel="apple-touch-icon" href="${BASE_URL}/apple-touch-icon.png" />

  <!-- Open Graph -->
  <meta property="og:type"         content="website" />
  <meta property="og:url"          content="${esc(shareUrl)}" />
  <meta property="og:title"        content="${esc(ogTitle)}" />
  <meta property="og:description"  content="${esc(ogDescription)}" />
  <meta property="og:image"        content="${esc(cardUrl)}" />
  <meta property="og:image:width"  content="${meta.imageWidth}" />
  <meta property="og:image:height" content="${meta.imageHeight}" />
  <meta property="og:image:type"   content="image/png" />
  <meta property="og:image:alt"    content="${esc(meta.imageAlt)}" />
  <meta property="og:site_name"    content="${esc(meta.siteName)}" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription)}" />
  <meta name="twitter:image"       content="${esc(cardUrl)}" />
  <meta name="twitter:image:alt"   content="${esc(meta.imageAlt)}" />

  <!-- JS redirect: real browsers jump immediately; OG scrapers (iMessage, WhatsApp)
       don't execute JS, so they read the meta tags above.
       link_id and gen are forwarded so share-loop attribution survives the redirect,
       and f (the sharer's pick, see lib/matchShare.ts) so "did we match" works. -->
  <script>
    (function() {
      var dst = new URL(${JSON.stringify(appUrl)}, location.origin);
      var src = new URLSearchParams(location.search);
      if (src.get('link_id')) dst.searchParams.set('link_id', src.get('link_id'));
      if (src.get('gen')) dst.searchParams.set('gen', src.get('gen'));
      if (src.get('f')) dst.searchParams.set('f', src.get('f'));
      window.location.replace(dst.toString());
    })();
  </script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${bgColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: ${cardBg};
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(128,128,128,0.12);
      border-radius: 9999px;
      padding: 4px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: ${mutedCol};
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .question {
      color: ${textCol};
      font-size: 18px;
      font-weight: 700;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .or {
      color: ${mutedCol};
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 2px;
      margin: 8px 0;
    }
    .cta {
      display: inline-block;
      background: ${ctaCol};
      color: ${ctaText};
      padding: 13px 32px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 16px;
      text-decoration: none;
      margin-top: 4px;
    }
    .hint {
      color: ${mutedCol};
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${catEmoji} ${esc(catLabel)}</div>
    <div class="question">
      ${esc(displayOptA)}
      <div class="or">&mdash; OR &mdash;</div>
      ${esc(displayOptB)}
    </div>
    <a class="cta" href="${esc(appUrl)}">Play Along &rarr;</a>
    <p class="hint">Loading the question&hellip;</p>
  </div>
</body>
</html>`;

  await writeFile(join(OUT_DIR, `${id}.html`), html, 'utf-8');
  count++;
}

console.log(`Generated ${count} static sharing pages in dist/p/`);
