// SAT-717: Facebook — OG share card validation with facebookexternalhit UA
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

  // 1. Validate OG tags with Facebook crawler UA
  await page.setExtraHTTPHeaders({
    'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
  });
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });

  const ogType = await page.$eval('meta[property="og:type"]', el => el.getAttribute('content'));
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  const ogImageWidth = await page.$eval('meta[property="og:image:width"]', el => el.getAttribute('content'));
  const ogImageHeight = await page.$eval('meta[property="og:image:height"]', el => el.getAttribute('content'));
  const ogImageType = await page.$eval('meta[property="og:image:type"]', el => el.getAttribute('content')).catch(() => null);
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'));
  const ogDesc = await page.$eval('meta[property="og:description"]', el => el.getAttribute('content'));
  const ogUrl = await page.$eval('meta[property="og:url"]', el => el.getAttribute('content'));
  const ogSiteName = await page.$eval('meta[property="og:site_name"]', el => el.getAttribute('content')).catch(() => null);

  assert(ogType === 'website', `og:type = website (got: ${ogType})`);
  assert(ogImage && ogImage.startsWith('http'), 'og:image is absolute HTTPS URL');
  assert(ogImage && ogImage.includes('/api/card'), 'og:image points to card endpoint');
  assert(ogImageWidth === '1200', `og:image:width = 1200 (got: ${ogImageWidth})`);
  assert(ogImageHeight === '628', `og:image:height = 628 (got: ${ogImageHeight})`);
  assert(ogImageType === 'image/png', `og:image:type = image/png (got: ${ogImageType})`);
  assert(ogTitle && ogTitle.length > 0 && ogTitle.length <= 55, `og:title 1-55 chars (got ${ogTitle?.length})`);
  assert(ogDesc && ogDesc.length > 0, 'og:description present');
  assert(ogUrl && ogUrl.startsWith('http'), 'og:url is absolute URL');
  assert(ogSiteName === 'Would You Rather', `og:site_name present (got: ${ogSiteName})`);

  // 2. Render card at 1200x628 and screenshot
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(CARD_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'facebook-card-1.91.png', fullPage: false });

  // 3. Verify card image is served with correct Content-Type
  const response = await page.request.get(CARD_URL);
  const contentType = response.headers()['content-type'];
  assert(contentType && contentType.includes('image/png'), `Card returns image/png (got: ${contentType})`);

  return { ...results, ogType, ogImage, ogImageWidth, ogImageHeight, ogTitle, ogDesc };
}
