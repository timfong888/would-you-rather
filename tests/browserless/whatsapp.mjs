// SAT-716: WhatsApp — link preview OG validation + absolute URL enforcement
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

  // 1. Validate OG tags with WhatsApp-like user agent
  await page.setExtraHTTPHeaders({ 'User-Agent': 'WhatsApp/2.24.0 A' });
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });

  const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'));
  const ogDesc = await page.$eval('meta[property="og:description"]', el => el.getAttribute('content'));
  const ogUrl = await page.$eval('meta[property="og:url"]', el => el.getAttribute('content'));
  const ogImageType = await page.$eval('meta[property="og:image:type"]', el => el.getAttribute('content')).catch(() => null);
  const ogSiteName = await page.$eval('meta[property="og:site_name"]', el => el.getAttribute('content')).catch(() => null);
  const ogImageWidth = await page.$eval('meta[property="og:image:width"]', el => el.getAttribute('content')).catch(() => null);
  const ogImageHeight = await page.$eval('meta[property="og:image:height"]', el => el.getAttribute('content')).catch(() => null);

  // Critical: og:image must be an absolute URL
  assert(ogImage && ogImage.startsWith('http'), `og:image is absolute URL (got: ${ogImage})`);
  assert(ogImage && ogImage.includes('/api/card'), 'og:image points to card endpoint');
  assert(ogTitle && ogTitle.length <= 55, `og:title ≤55 chars (got ${ogTitle?.length})`);
  assert(ogDesc && ogDesc.length > 0, 'og:description present');
  assert(ogUrl && ogUrl.startsWith('http'), `og:url is absolute URL (got: ${ogUrl})`);
  assert(ogImageType === 'image/png', 'og:image:type = image/png');
  assert(ogSiteName === 'Would You Rather', `og:site_name present (got: ${ogSiteName})`);
  assert(ogImageWidth === '1200', 'og:image:width = 1200');
  assert(ogImageHeight === '628', 'og:image:height = 628');

  // 2. Render card at 1.91:1
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(CARD_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'whatsapp-card-1.91.png', fullPage: false });

  // 3. Validate tags are consistent across user agents (no UA-sniffing)
  await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0' });
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });
  const ogImageStandard = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  assert(ogImageStandard === ogImage, 'OG tags consistent across user agents');

  return { ...results, ogImage, ogTitle, ogDesc, ogUrl, ogImageType, ogSiteName };
}
