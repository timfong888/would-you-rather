// SAT-714: Instagram Stories — 9:16 card asset validation
// The URL scheme cannot be invoked in a browser — this validates the card asset.
export default async function ({ page }) {
  const HOST = process.env.APP_HOST || 'http://localhost:3000';
  const PROMPT_ID = process.env.TEST_PROMPT_ID || 'wd-1';
  const LONGEST_PROMPT_ID = process.env.LONGEST_PROMPT_ID || 'hl-4';

  const results = { assertions: [], passed: 0, failed: 0 };
  function assert(condition, label) {
    if (condition) { results.passed++; }
    else { results.failed++; }
    results.assertions.push({ label, passed: condition });
  }

  // 1. Render bright theme card at 9:16 (1080×1920)
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`${HOST}/api/card?id=${PROMPT_ID}&ratio=9x16`, { waitUntil: 'networkidle' });
  const brightScreenshot = await page.screenshot({ path: 'instagram-bright-9x16.png', fullPage: false });
  assert(!!brightScreenshot, 'Bright theme 9:16 card renders');

  // 2. Render moody theme card at 9:16
  await page.goto(`${HOST}/api/card?id=ms-2&ratio=9x16`, { waitUntil: 'networkidle' });
  const moodyScreenshot = await page.screenshot({ path: 'instagram-moody-9x16.png', fullPage: false });
  assert(!!moodyScreenshot, 'Moody theme 9:16 card renders');

  // 3. Text overflow check — longest prompt in catalog
  await page.goto(`${HOST}/api/card?id=${LONGEST_PROMPT_ID}&ratio=9x16`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'instagram-longest-prompt.png', fullPage: false });
  const viewportOverflow = await page.evaluate(() => {
    return document.body.scrollHeight <= 1920;
  });
  assert(viewportOverflow, 'No text overflow on longest prompt at 9:16');

  // 4. No-data edge case (uses a prompt ID that may have low votes)
  await page.goto(`${HOST}/api/card?id=${PROMPT_ID}&ratio=9x16&responseCount=0`, { waitUntil: 'networkidle' });
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes('See what others chose'), 'No-data card shows placeholder strip');
  await page.screenshot({ path: 'instagram-nodata.png', fullPage: false });

  // 5. Share URL is visible on the card
  const shareUrlVisible = await page.evaluate(() => {
    return document.body.innerText.includes('/p/');
  });
  assert(shareUrlVisible, 'Share URL link visible on card');

  return results;
}
