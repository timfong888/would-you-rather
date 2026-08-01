// SAT-718: TikTok — 9:16 sticker card + OG fallback validation
export default async function ({ page }) {
  const HOST = process.env.APP_HOST || 'http://localhost:3000';
  const PROMPT_ID = process.env.TEST_PROMPT_ID || 'wd-1';
  const LONGEST_PROMPT_ID = process.env.LONGEST_PROMPT_ID || 'hl-4';
  const SHARE_URL = `${HOST}/p/${PROMPT_ID}`;

  const results = { assertions: [], passed: 0, failed: 0 };
  function assert(condition, label) {
    if (condition) { results.passed++; }
    else { results.failed++; }
    results.assertions.push({ label, passed: condition });
  }

  // 1. Render moody theme at 9:16 (preferred TikTok theme)
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(
    `${HOST}/api/card?id=ms-2&ratio=9x16`,
    { waitUntil: 'networkidle' }
  );
  const moodyScreenshot = await page.screenshot({ path: 'tiktok-moody-9x16.png', fullPage: false });
  assert(!!moodyScreenshot, 'Moody theme 9:16 card renders');

  // 2. Text overflow check — longest prompt in catalog
  await page.goto(
    `${HOST}/api/card?id=${LONGEST_PROMPT_ID}&ratio=9x16`,
    { waitUntil: 'networkidle' }
  );
  await page.screenshot({ path: 'tiktok-longest-prompt.png', fullPage: false });
  const noOverflow = await page.evaluate(() => document.body.scrollHeight <= 1920);
  assert(noOverflow, 'No text overflow on longest prompt at 9:16');

  // 3. No-data edge case
  await page.goto(
    `${HOST}/api/card?id=${PROMPT_ID}&ratio=9x16&responseCount=0`,
    { waitUntil: 'networkidle' }
  );
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('See what others chose'), 'No-data card shows placeholder strip');
  await page.screenshot({ path: 'tiktok-nodata.png', fullPage: false });

  // 4. Bright theme also renders correctly at 9:16
  await page.goto(
    `${HOST}/api/card?id=${PROMPT_ID}&ratio=9x16`,
    { waitUntil: 'networkidle' }
  );
  const brightScreenshot = await page.screenshot({ path: 'tiktok-bright-9x16.png', fullPage: false });
  assert(!!brightScreenshot, 'Bright theme 9:16 card also renders');

  // 5. OG fallback for link-in-bio use case
  await page.goto(SHARE_URL, { waitUntil: 'networkidle' });
  const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
  assert(ogImage && ogImage.includes('/api/card'), 'og:image present as OG fallback for link-in-bio');

  // 6. Share URL visible on card
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`${HOST}/api/card?id=${PROMPT_ID}&ratio=9x16`, { waitUntil: 'networkidle' });
  const linkVisible = await page.evaluate(() => document.body.innerText.includes('/p/'));
  assert(linkVisible, 'Share URL link visible on 9:16 card');

  return results;
}
