// A pillar guide page (/guides/<slug>), issue #211. Pure: shared by scripts/generate-guide-pages.mjs and the unit tests.
// Read-only: no script but JSON-LD, no form or vote control. Links go to the question pages, category pages, landing pages,
// other guides and the hub. A kids guide links only to kids destinations and sends or stores nothing.
import { SITE_NAME } from './site.js';
import { lowerFirst } from './sharePage.js';
import { GUIDES } from './guides.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function guidePageHtml({ guide, questionsById, categoriesById, landingTitles, origin }) {
  const url = `${origin}/guides/${guide.slug}`;
  const hub = guide.kids ? `${origin}/kids` : `${origin}/`;
  const otherGuides = GUIDES.filter((g) => g.slug !== guide.slug && g.kids === guide.kids);
  const usedCategories = [];
  for (const s of guide.sections) {
    for (const id of s.ids) {
      const cat = categoriesById.get(questionsById.get(id).category);
      if (cat && !usedCategories.includes(cat)) usedCategories.push(cat);
    }
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: guide.h1,
        description: guide.description,
        inLanguage: 'en',
        dateModified: guide.updated,
        mainEntityOfPage: url,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: origin },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: guide.h1, item: url },
        ],
      },
    ],
  };
  const question = (id) => {
    const q = questionsById.get(id);
    return `<li><a href="${origin}/q/${esc(id)}">Would you rather ${esc(lowerFirst(q.optionA))} or ${esc(lowerFirst(q.optionB))}?</a></li>`;
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(guide.title)} | ${esc(SITE_NAME)}</title>
<meta name="description" content="${esc(guide.description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${esc(url)}" />
<link rel="icon" href="${origin}/favicon.ico" />
<link rel="apple-touch-icon" href="${origin}/apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:title" content="${esc(guide.title)}" />
<meta property="og:description" content="${esc(guide.description)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${esc(guide.title)}" />
<meta name="twitter:description" content="${esc(guide.description)}" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<style>
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F5E6F0;color:#1A1A2E;line-height:1.6}
main{max-width:680px;margin:0 auto;padding:24px 20px 56px}
.crumbs{font-size:13px;color:#6b6b80;margin-bottom:16px}
.crumbs a{color:#6b6b80}
h1{font-size:28px;line-height:1.25;margin:0 0 16px}
h2{font-size:20px;margin:32px 0 8px}
ul{padding-left:20px}
li{margin:6px 0}
a{color:#B8236C}
.cta{display:inline-block;background:#D63384;color:#fff;padding:13px 28px;border-radius:9999px;font-weight:700;text-decoration:none;margin:12px 0}
</style>
</head>
<body>
<main>
<nav class="crumbs"><a href="${hub}">Home</a> › ${esc(guide.h1)}</nav>
<h1>${esc(guide.h1)}</h1>
${guide.intro.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${guide.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n<p>${esc(s.text)}</p>\n<ul>\n${s.ids.map(question).join('\n')}\n</ul>`).join('\n')}
<h2>Tips for playing</h2>
<ul>
${guide.tips.map((t) => `<li>${esc(t)}</li>`).join('\n')}
</ul>
<h2>Keep playing</h2>
<p>Want to pick a side and see how others answered? Play it in the app.</p>
<a class="cta" href="${hub}">Play Would You Rather</a>
<ul>
${usedCategories.map((c) => `<li><a href="${origin}/categories/${esc(c.id)}">More ${esc(c.label)} questions</a></li>`).join('\n')}
${guide.landing.map((slug) => `<li><a href="${origin}/${esc(slug)}">${esc(landingTitles.get(slug) ?? slug)}</a></li>`).join('\n')}
${otherGuides.map((g) => `<li><a href="${origin}/guides/${esc(g.slug)}">${esc(g.h1)}</a></li>`).join('\n')}
</ul>
</main>
</body>
</html>
`;
}
