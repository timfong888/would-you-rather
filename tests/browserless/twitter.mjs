// SAT-715: Twitter/X — summary_large_image card + OG fallback validation
export default async function ({ page }) {
  const HOST = process.env.APP_HOST || 'http://localhost:3000';
  const PROMPT_ID = process.env.TEST_PROMPT_ID || 'wd-1';
  const SHARE_URL = `${HOST}/p/${PROMPT_ID}`;
  const CARD_URL = `${HOST}/api/card?id=${PROMPT_ID}&ratio=1.91x1`;

  const results = { assertions: [], passed: 0, failed: 0 };
  function assert(condition, label) {
    if (condition) { results.passed++; }
    else { results.failed++; }
    results.assertions.push({ label, passed: condition });
  }

  // 1. Validate Twitter Card + OG meta tags
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });

  const twitterCard = await page.$eval('meta[name="twitter:card"]', el => el.getAttribute('content'));
  const twitterTitle = await page.$eval('meta[name="twitter:title"]', el => el.getAttribute('content'));
  const twitterDesc = await page.$eval('meta[name="twitter:description"]', el => el.getAttribute('content'));
  const twitterImage = await page.$eval('meta[name="twitter:image"]', el => el.getAttribute('content'));
  const twitterImageAlt = await page.$eval('meta[name="twitter:image:alt"]', el => el.getAttribute('content')).catch(() => null);
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));

  assert(twitterCard === 'summary_large_image', `twitter:card = summary_large_image (got: ${twitterCard})`);
  assert(twitterTitle && twitterTitle.length <= 55, `twitter:title ≤55 chars (got ${twitterTitle?.length})`);
  assert(twitterDesc && twitterDesc.length > 0, 'twitter:description present');
  assert(twitterImage && twitterImage.includes('/api/card'), 'twitter:image points to card endpoint');
  assert(twitterImageAlt && twitterImageAlt.length > 0, 'twitter:image:alt present for accessibility');
  assert(ogImage && ogImage.includes('/api/card'), 'og:image present as fallback');

  // 2. Verify card image renders at correct dimensions
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(CARD_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'twitter-card-1.91.png', fullPage: false });

  // 3. Test with Twitterbot user-agent
  await page.setExtraHTTPHeaders({ 'User-Agent': 'Twitterbot/1.0' });
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });
  const twitterCardUA = await page.$eval('meta[name="twitter:card"]', el => el.getAttribute('content'));
  assert(twitterCardUA === 'summary_large_image', 'Tags served correctly to Twitterbot UA');

  return { ...results, twitterCard, twitterTitle, twitterDesc, twitterImage, twitterImageAlt };
}
