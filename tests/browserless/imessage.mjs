// SAT-713: iMessage — OG tag validation + card render test
// Run via: browserless_function or node --experimental-vm-modules
export default async function ({ page }) {
  const HOST = process.env.APP_HOST || 'http://localhost:3000';
  const PROMPT_ID = process.env.TEST_PROMPT_ID || 'wd-1';
  const SHARE_URL = `${HOST}/p/${PROMPT_ID}`;
  const CARD_URL = `${HOST}/api/card?id=${PROMPT_ID}&ratio=1.91x1`;
  const CARD_URL_NO_DATA = `${HOST}/api/card?id=no-data-prompt&ratio=1.91x1&responseCount=0`;

  const results = { assertions: [], passed: 0, failed: 0 };
  function assert(condition, label) {
    if (condition) { results.passed++; }
    else { results.failed++; }
    results.assertions.push({ label, passed: condition });
  }

  // 1. Validate OG meta tags on the share URL
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });

  const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'));
  const ogDesc = await page.$eval('meta[property="og:description"]', el => el.getAttribute('content'));
  const ogWidth = await page.$eval('meta[property="og:image:width"]', el => el.getAttribute('content'));
  const ogHeight = await page.$eval('meta[property="og:image:height"]', el => el.getAttribute('content'));
  const ogImageType = await page.$eval('meta[property="og:image:type"]', el => el.getAttribute('content')).catch(() => null);

  assert(ogImage && ogImage.includes('/api/card'), 'og:image points to card endpoint');
  assert(ogImage && ogImage.startsWith('http'), 'og:image is absolute URL');
  assert(ogTitle && ogTitle.length <= 55, `og:title ≤55 chars (got ${ogTitle?.length})`);
  assert(ogDesc && ogDesc.length > 0, 'og:description is present');
  assert(ogWidth === '1200', 'og:image:width = 1200');
  assert(ogHeight === '628', 'og:image:height = 628');
  assert(ogImageType === 'image/png', 'og:image:type = image/png');

  // 2. Render card at correct dimensions
  await page.setViewportSize({ width: 1200, height: 628 });
  await page.goto(CARD_URL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'imessage-card-1.91.png', fullPage: false });

  return { ...results, ogImage, ogTitle, ogDesc, ogWidth, ogHeight, ogImageType };
}
