// The indexed, read-only question page (/q/<id>), docs/specs/seo-question-pages.md section 2 (#206).
// Pure (no fs, no network) so scripts/generate-question-pages.mjs and the unit tests share it.
//
// Read-only: no script, no form, no vote control. Its one action is a link into the playable web app.
// Kids pages follow the kids rule: nothing is loaded, stored or sent, and links go only to kids destinations.
import { SITE_NAME } from './site.js';
import { sharePageMeta, lowerFirst } from './sharePage.js';
import { LANDING_FOR_CATEGORY, isSeoBatchId } from './seoBatch.js';

const esc = (str) =>
  String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const RELATED_COUNT = 5;

/** Related questions: same category first, then other batch questions, only ones that have a /q page. */
export function relatedQuestions(question, questions, count = RELATED_COUNT) {
  const pool = questions.filter((q) => q.id !== question.id && isSeoBatchId(q.id));
  const same = pool.filter((q) => q.category === question.category);
  const kidsOnly = question.id.startsWith('kf-') || question.id.startsWith('tn-');
  const others = pool.filter((q) => q.category !== question.category && (!kidsOnly || q.id.startsWith('kf-') || q.id.startsWith('tn-')));
  // A stable rotation so neighbouring pages do not all share the same five.
  const at = same.findIndex((q) => q.id > question.id);
  const rotated = at > 0 ? [...same.slice(at), ...same.slice(0, at)] : same;
  return [...rotated, ...others].slice(0, count);
}

const PERSONA_COPY = {
  kids:
    'A would-you-rather question gives a child something easy to answer and a reason to explain it. That is the habit of talking: ' +
    'pick a side, say why, listen to the other person. It works at the dinner table, in the car and at bedtime, and it is a way for a parent or dad to connect with a child.',
  adult:
    'A would-you-rather question starts a conversation in a few seconds. Pick a side, say why, and see where the other person lands. ' +
    'It works on a date, at a table of friends or on a long drive.',
};

// Two separate ideas:
// - `categoryCta`: the one call to action leads to the category's free questions instead of the playable screen (batches two and
//   three: the playable screen of a question can hit the paywall). Implied by `paid`.
// - `paid`: the question is a paid-tier question (batch two), so the page also says it is an extra question in the pack.
export function questionPageHtml({ question, category, related, origin, paid = false, categoryCta = false }) {
  const kids = !!category && category.audience !== 'adult';
  const meta = sharePageMeta(question, origin);
  const a = lowerFirst(question.optionA);
  const b = lowerFirst(question.optionB);
  const title = `Would you rather ${a} or ${b}?`;
  const url = `${origin}/q/${question.id}`;
  const play = `${origin}/game/${question.id}?cat=${encodeURIComponent(question.category)}`;
  const hub = kids ? `${origin}/kids` : `${origin}/`;
  const catUrl = category ? `${origin}/categories/${category.id}` : hub;
  const landingSlug = LANDING_FOR_CATEGORY[question.category];
  const intro = category
    ? `One of the ${category.label} would-you-rather questions${kids ? ` for ages ${category.ages[0]} to ${category.ages[1]}` : ''}. Pick a side, then ask the other person why.`
    : 'A would-you-rather question. Pick a side, then ask the other person why.';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, inLanguage: 'en', breadcrumb: { '@id': `${url}#breadcrumb` } },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          ...(category ? [{ '@type': 'ListItem', position: 2, name: category.label, item: catUrl }] : []),
          { '@type': 'ListItem', position: category ? 3 : 2, name: title, item: url },
        ],
      },
    ],
  };
  const li = (q) => `<li><a href="${origin}/q/${esc(q.id)}">Would you rather ${esc(lowerFirst(q.optionA))} or ${esc(lowerFirst(q.optionB))}?</a></li>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title.length > 70 ? title.slice(0, 69) + '…' : title)} | ${esc(SITE_NAME)}</title>
<meta name="description" content="${esc(title)} Pick a side, then play it in the app and see how others answered." />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" href="${origin}/favicon.ico" />
<link rel="apple-touch-icon" href="${origin}/apple-touch-icon.png" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(meta.description)}" />
<meta property="og:image" content="${esc(meta.image)}" />
<meta property="og:image:width" content="${meta.imageWidth}" />
<meta property="og:image:height" content="${meta.imageHeight}" />
<meta property="og:image:alt" content="${esc(meta.imageAlt)}" />
<meta property="og:site_name" content="${esc(meta.siteName)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:image" content="${esc(meta.image)}" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5E6F0;color:#1A1A2E;line-height:1.55}
main{max-width:640px;margin:0 auto;padding:24px 20px 48px}
.crumbs{font-size:13px;color:#6b6b80;margin-bottom:16px}
.crumbs a{color:#6b6b80}
h1{font-size:24px;line-height:1.3;margin:0 0 16px}
.opts{background:#fff;border-radius:16px;padding:20px;margin:0 0 16px}
.opt{font-size:18px;font-weight:700;margin:0}
.or{font-size:12px;font-weight:800;letter-spacing:2px;color:#9090A8;margin:10px 0}
.cta{display:inline-block;background:#D63384;color:#fff;padding:13px 28px;border-radius:9999px;font-weight:700;text-decoration:none;margin:8px 0 24px}
h2{font-size:17px;margin:28px 0 8px}
ul{padding-left:20px;margin:0}
a{color:#B8236C}
</style>
</head>
<body>
<main>
<nav class="crumbs"><a href="${hub}">Home</a>${category ? ` › <a href="${catUrl}">${esc(category.label)}</a>` : ''}</nav>
<h1>${esc(title)}</h1>
<div class="opts">
<p class="opt">${esc(question.optionA)}</p>
<p class="or">OR</p>
<p class="opt">${esc(question.optionB)}</p>
</div>
${(paid || categoryCta) && category ? `<a class="cta" href="${esc(catUrl)}">Play the free ${esc(category.label)} questions</a>` : `<a class="cta" href="${esc(play)}">Play this question</a>`}
<p>${esc(intro)}${paid ? ' It is one of the extra questions in this pack; the free questions in the app are a good place to start.' : ''}</p>
<h2>Why ask questions like this</h2>
<p>${esc(kids ? PERSONA_COPY.kids : PERSONA_COPY.adult)}</p>
${related.length ? `<h2>More questions like this</h2>\n<ul>\n${related.map(li).join('\n')}\n</ul>` : ''}
<h2>Keep going</h2>
<ul>
${category ? `<li><a href="${catUrl}">More ${esc(category.label)} questions</a></li>` : ''}
${landingSlug ? `<li><a href="${origin}/${esc(landingSlug)}">The full list of questions for this situation</a></li>` : ''}
<li><a href="${hub}">${kids ? 'Would You Rather for kids and family' : 'Play Would You Rather'}</a></li>
</ul>
</main>
</body>
</html>
`;
}
