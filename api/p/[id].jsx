// Vercel Edge Function — dynamic OG landing page for shared prompt links.
// Rewrite rule in vercel.json maps /p/:id → /api/p/:id.
// Returns an HTML document with full OG + Twitter Card meta tags, then
// JS-redirects to /game/:id so the recipient can play along.
// NOTE: Uses a JS redirect (not meta http-equiv) so OG scrapers (iMessage,
// WhatsApp, Twitter bots) never follow the redirect and always see the OG tags.
import { QUESTIONS, CATEGORIES, THEME_FOR_CATEGORY } from '../_lib/data.js';

export const config = { runtime: 'edge' };

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

export default function handler(req) {
  const url = new URL(req.url);
  // Read id from the URL path: /api/p/:id → last path segment
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[pathParts.length - 1];

  const question = QUESTIONS.find(q => q.id === id);
  if (!question) {
    return Response.redirect(`${url.origin}/`, 302);
  }

  const category = CATEGORIES.find(c => c.id === question.category);
  const themeName = THEME_FOR_CATEGORY[question.category] || 'bright';
  const isMoody = themeName === 'moody';

  // voted=A|B passed by the "Share my take" flow — threads through to the card
  const voted = url.searchParams.get('voted') || '';

  const baseUrl = url.origin;
  const cardUrl = `${baseUrl}/api/card?id=${encodeURIComponent(id)}&ratio=1.91x1${voted ? `&voted=${encodeURIComponent(voted)}` : ''}`;
  const appUrl  = `${baseUrl}/game/${id}?cat=${question.category}`;
  const shareUrl = voted ? `${baseUrl}/p/${id}?voted=${voted}` : `${baseUrl}/p/${id}`;

  // OG title ≤ 55 chars: "WYR: [optA] or [optB]?"
  const shortA = truncate(question.optionA, 28);
  const shortB = truncate(question.optionB, 28);
  const rawTitle = `WYR: ${shortA} or ${shortB}?`;
  const ogTitle = truncate(rawTitle, 55);

  // Description: curiosity-gap hook
  const totalVotes = question.votesA + question.votesB;
  const pctA = totalVotes > 0 ? Math.round((question.votesA / totalVotes) * 100) : 0;
  const pctB = 100 - pctA;
  const ogDescription = totalVotes >= 5
    ? `${pctA}% vs ${pctB}% — where do YOU stand? Answer the question to see the full breakdown.`
    : `Where do YOU stand? Play along and see what others chose.`;

  // Visible card content for the no-JS fallback
  const displayOptA = truncate(question.optionA, 200);
  const displayOptB = truncate(question.optionB, 200);
  const catEmoji = category ? category.emoji : '🎲';
  const catLabel = category ? category.label : 'Would You Rather';

  const bgColor  = isMoody ? '#0D0D1A' : '#F5E6F0';
  const cardBg   = isMoody ? '#1C0D30' : '#FFFFFF';
  const textCol  = isMoody ? '#FFFFFF' : '#1A1A2E';
  const mutedCol = isMoody ? 'rgba(255,255,255,0.5)' : '#9090A8';
  const ctaCol   = isMoody ? '#C9A84C' : '#D63384';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(ogTitle)}</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${esc(shareUrl)}" />
  <meta property="og:title"       content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDescription)}" />
  <meta property="og:image"       content="${esc(cardUrl)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="628" />
  <meta property="og:image:type"  content="image/png" />
  <meta property="og:site_name"   content="Would You Rather" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription)}" />
  <meta name="twitter:image"       content="${esc(cardUrl)}" />
  <meta name="twitter:image:alt"   content="${esc(ogTitle)}" />

  <!-- JS redirect: runs in real browsers but skipped by OG scrapers (iMessage, WhatsApp, etc.) -->
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>

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
      color: ${isMoody ? '#0D0D1A' : '#FFFFFF'};
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
      <div class="or">— OR —</div>
      ${esc(displayOptB)}
    </div>
    <a class="cta" href="${esc(appUrl)}">Play Along →</a>
    <p class="hint">Loading the question…</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
