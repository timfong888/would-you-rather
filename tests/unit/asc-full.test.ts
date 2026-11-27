import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// @ts-ignore plain .mjs modules
import { validateListingFull, dryRunReport, verifyGoComment, stillBlockedList, pngDimensions, checkedFull, uploadScreenshots, SCREENSHOT_DISPLAY_TYPE, SCREENSHOT_WIDTH, SCREENSHOT_HEIGHT } from '../../scripts/lib/ascFull.mjs';
// @ts-ignore
import { validateListing } from '../../scripts/lib/ascMetadata.mjs';

const listing = JSON.parse(readFileSync('store/ios/listing-final.json', 'utf8'));

// --- listing-final.json correctness ---

test('listing-final.json is fully valid (text + extended fields)', () => {
  assert.deepEqual(validateListingFull(listing), [], 'expected no errors');
});

test('listing is not yet approved', () => {
  assert.equal(listing.approved, false);
});

test('description uses Family wording, not "Kids & Family"', () => {
  assert.doesNotMatch(listing.version.description, /Kids & Family/, 'description must say "Family category" not "Kids & Family"');
  assert.match(listing.version.description, /Family category/i);
});

test('description does not claim a free-question count', () => {
  // No specific category listed as free, no "X free questions" pattern
  assert.doesNotMatch(listing.version.description, /\d+\s+free\s+question/i);
  assert.doesNotMatch(listing.version.description, /free to play/i);
});

test('promotional text is within 170-char limit', () => {
  const pt = listing.version.promotionalText;
  assert.ok(typeof pt === 'string' && pt.trim(), 'promotionalText must be present');
  assert.ok([...pt].length <= 170, `promotionalText is ${[...pt].length} chars (limit 170)`);
});

test('name and subtitle are within 30-char limit', () => {
  assert.ok([...listing.appInfo.name].length <= 30, `name is ${[...listing.appInfo.name].length} chars`);
  assert.ok([...listing.appInfo.subtitle].length <= 30, `subtitle is ${[...listing.appInfo.subtitle].length} chars`);
});

test('name, subtitle and keywords have no "kids" or "children"', () => {
  for (const v of [listing.appInfo.name, listing.appInfo.subtitle, listing.version.keywords]) {
    assert.doesNotMatch(v, /\bkids?\b|\bchildren\b/i);
  }
  assert.ok(typeof listing.version.keywords === 'string' && listing.version.keywords.trim(), 'keywords must be a non-empty string');
  assert.ok([...listing.version.keywords].length <= 100, `keywords is ${[...listing.version.keywords].length} chars (limit 100)`);
});

test('no repeated words across name, subtitle and keywords (case-insensitive)', () => {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const nameWords = new Set(words(listing.appInfo.name));
  const subWords = new Set(words(listing.appInfo.subtitle));

  // name vs subtitle — "family" in both is an accepted trade-off per Tim's decision (8.8 D4)
  const nameSub = [...subWords].filter((w) => nameWords.has(w) && w !== 'family');
  assert.deepEqual(nameSub, [], `name/subtitle repeats: ${nameSub.join(', ')}`);

  // keywords must not repeat any word from name or subtitle
  const combined = new Set([...nameWords, ...subWords]);
  const kwWords = listing.version.keywords ? words(listing.version.keywords.replace(/,/g, ' ')) : [];
  const kwRepeats = kwWords.filter((w) => combined.has(w));
  assert.deepEqual(kwRepeats, [], `keywords repeat name/subtitle words: ${kwRepeats.join(', ')}`);
});

test('primaryCategory is ENTERTAINMENT', () => {
  assert.equal(listing.appInfo.primaryCategory, 'ENTERTAINMENT');
  assert.equal(listing.appInfo.secondaryCategory, null, 'secondaryCategory is null — Tim decides');
});

test('releaseType is MANUAL', () => {
  assert.equal(listing.releaseType, 'MANUAL');
});

test('territories is US-only', () => {
  assert.deepEqual(listing.territories, ['USA']);
});

test('price is 0 (free)', () => {
  assert.equal(listing.price, 0);
});

test('attachAllIap is true', () => {
  assert.equal(listing.attachAllIap, true);
});

test('reviewNotes are present and within 4000 chars', () => {
  assert.ok(typeof listing.reviewNotes === 'string' && listing.reviewNotes.trim());
  assert.ok([...listing.reviewNotes].length <= 4000);
  assert.doesNotMatch(listing.reviewNotes, /contact name|phone number/i, 'review notes must not contain contact name or phone');
});

test('ageRatingDeclaration matches section 5.1 audit', () => {
  const ard = listing.ageRatingDeclaration;
  assert.ok(ard, 'ageRatingDeclaration must be present');
  assert.equal(ard.madeForKids, false);
  assert.equal(ard.kidsAgeBand, null);
  assert.equal(ard.profanityOrCrudeHumor, 'INFREQUENT_OR_MILD', '5.1: gross-out questions');
  assert.equal(ard.alcoholTobaccoOrDrugUseOrReferences, 'INFREQUENT_OR_MILD', '5.1: hl-16/17 questions');
  assert.equal(ard.matureOrSuggestiveThemes, 'INFREQUENT_OR_MILD', '5.1: Moral Compass dilemmas');
  assert.equal(ard.sexualContentOrNudity, 'NONE');
  assert.equal(ard.realisticViolence, 'NONE');
  assert.equal(ard.gamblingAndContests, 'NONE');
  assert.equal(ard.unrestrictedWebAccess, false);
});

// --- character-count limits (independent of listing file) ---

test('validateListing accepts null keywords', () => {
  const copy = { ...listing, version: { ...listing.version, keywords: null } };
  assert.deepEqual(validateListing(copy), []);
});

test('validateListingFull rejects releaseType other than MANUAL or AFTER_APPROVAL', () => {
  const copy = { ...listing, releaseType: 'AUTOMATIC' };
  const errs = validateListingFull(copy);
  assert.ok(errs.some((e) => /releaseType/.test(e)), `expected releaseType error, got: ${errs.join('; ')}`);
});

test('validateListingFull rejects reviewNotes over 4000 chars', () => {
  const copy = { ...listing, reviewNotes: 'x'.repeat(4001) };
  const errs = validateListingFull(copy);
  assert.ok(errs.some((e) => /reviewNotes/.test(e)));
});

// --- dryRunReport shape ---

test('dryRunReport includes all required field labels', () => {
  const report = dryRunReport(listing, null);
  for (const field of ['name (appInfo)', 'description', 'promotionalText', 'keywords', 'reviewNotes', 'ageRatingDeclaration', 'primaryCategory', 'releaseType', 'territories', 'price', 'attachAllIap']) {
    assert.match(report, new RegExp(field.replace(/[()]/g, '\\$&')), `field "${field}" missing from dry-run report`);
  }
});

test('dryRunReport marks keywords as pending when null', () => {
  const copy = { ...listing, version: { ...listing.version, keywords: null } };
  const report = dryRunReport(copy, null);
  assert.match(report, /pending/i);
});

// --- go comment verification ---

function mockFetch(overrides: { jsonBody?: Record<string, unknown>; ok?: boolean; status?: number } = {}) {
  const { jsonBody, ...responseOverrides } = overrides;
  const defaults = {
    ok: true,
    status: 200,
    json: async () => ({
      user: { login: 'timfong888' },
      issue_url: 'https://api.github.com/repos/timfong888/would-you-rather/issues/265',
      body: 'Ready. SUBMIT v1.0',
      created_at: '2026-11-27T00:00:00Z',
      ...(jsonBody ?? {}),
    }),
    ...responseOverrides,
  };
  return async (_url: string, _opts: unknown) => defaults as Response;
}

test('verifyGoComment passes for a valid comment', async () => {
  const result = await verifyGoComment({ commentId: '12345', fetch: mockFetch(), githubToken: 'tok' });
  assert.equal(result.ok, true);
  assert.equal(result.commentId, '12345');
});

test('verifyGoComment rejects non-numeric commentId', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: 'abc', fetch: mockFetch(), githubToken: 'tok' }),
    /numeric/,
  );
});

test('verifyGoComment rejects comment not on issue 265', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: '1', fetch: mockFetch({ jsonBody: { issue_url: 'https://api.github.com/repos/timfong888/would-you-rather/issues/100' } }), githubToken: 'tok' }),
    /not on issue 265/,
  );
});

test('verifyGoComment rejects comment by wrong user', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: '1', fetch: mockFetch({ jsonBody: { user: { login: 'someone-else' } } }), githubToken: 'tok' }),
    /not timfong888/,
  );
});

test('verifyGoComment rejects comment missing "SUBMIT v1.0"', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: '1', fetch: mockFetch({ jsonBody: { body: 'looks good, ship it' } }), githubToken: 'tok' }),
    /SUBMIT v1\.0/,
  );
});

test('verifyGoComment rejects 404', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: '99999', fetch: mockFetch({ ok: false, status: 404 }), githubToken: 'tok' }),
    /not found/i,
  );
});

test('verifyGoComment requires a non-empty commentId', async () => {
  await assert.rejects(
    () => verifyGoComment({ commentId: '', fetch: mockFetch(), githubToken: 'tok' }),
    /required/,
  );
});

// --- screenshot display type ---

test('screenshot display type is APP_IPHONE_69 for 1320x2868 (required 6.9" slot)', () => {
  assert.equal(SCREENSHOT_DISPLAY_TYPE, 'APP_IPHONE_69');
  assert.equal(SCREENSHOT_WIDTH, 1320);
  assert.equal(SCREENSHOT_HEIGHT, 2868);
});

test('pngDimensions reads width and height from a minimal PNG header', () => {
  // Build a minimal PNG IHDR: 8-byte sig + 4-byte len + IHDR + 4-byte w + 4-byte h + padding
  const buf = Buffer.alloc(24);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47; buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(1320, 16); // width
  buf.writeUInt32BE(2868, 20); // height
  const dims = pngDimensions(buf);
  assert.deepEqual(dims, { width: 1320, height: 2868 });
});

test('pngDimensions returns null for a non-PNG buffer', () => {
  assert.equal(pngDimensions(Buffer.from('not a png')), null);
});

test('pngDimensions returns null for a buffer that is too short', () => {
  assert.equal(pngDimensions(Buffer.alloc(10)), null);
});

// --- P1 regression tests ---

// P1-1: go-check step must not receive ASC secrets (they would cause an immediate exit-2)
test('workflow go-check step does not set ASC secrets', () => {
  const yaml = readFileSync('.github/workflows/apple-metadata.yml', 'utf8');
  // Extract the go-check step block: from "Verify go comment" to the next "- name:"
  const startIdx = yaml.indexOf('Verify go comment');
  const nextStepIdx = yaml.indexOf('- name:', startIdx + 1);
  const goCheckBlock = yaml.slice(startIdx, nextStepIdx);
  assert.doesNotMatch(goCheckBlock, /ASC_KEY_ID/, 'go-check step must not set ASC_KEY_ID');
  assert.doesNotMatch(goCheckBlock, /ASC_ISSUER_ID/, 'go-check step must not set ASC_ISSUER_ID');
  assert.doesNotMatch(goCheckBlock, /ASC_PRIVATE_KEY/, 'go-check step must not set ASC_PRIVATE_KEY');
  assert.match(goCheckBlock, /asc-gocheck\.mjs/, 'go-check step must run asc-gocheck.mjs');
});

// P1-2: checkedFull blocks any path not in ALLOWED or ALLOWED_EXTRA
test('checkedFull rejects paths outside the allow-list', async () => {
  const rawApi = async () => ({});
  const checked = checkedFull(rawApi);
  await assert.rejects(() => checked('DELETE', '/v1/apps/123'), /Blocked/, 'must block DELETE');
  await assert.rejects(() => checked('POST', '/v1/builds'), /Blocked/, 'must block POST /v1/builds');
  await assert.rejects(() => checked('GET', '/v1/users'), /Blocked/, 'must block GET /v1/users');
});

test('checkedFull allows paths in ALLOWED_EXTRA', async () => {
  const calls: string[] = [];
  const rawApi = async (m: string, p: string) => { calls.push(`${m} ${p}`); return {}; };
  const checked = checkedFull(rawApi);
  await checked('PATCH', '/v1/ageRatingDeclarations/abc-def');
  await checked('GET', '/v1/appStoreVersions/abc-def/appStoreReviewDetail');
  await checked('POST', '/v1/reviewSubmissions');
  assert.equal(calls.length, 3, 'all three allowed paths must reach rawApi');
});

// P1-3: uploadScreenshots calls upload once per uploadOperation (multipart support)
test('uploadScreenshots sends one PUT per upload operation', async () => {
  const uploadCalls: Array<{ url: string; data: Buffer }> = [];
  const mockUpload = async (url: string, data: Buffer) => { uploadCalls.push({ url, data }); };

  const pngBuf = Buffer.alloc(100);
  pngBuf[0] = 0x89; pngBuf[1] = 0x50; pngBuf[2] = 0x4e; pngBuf[3] = 0x47;
  pngBuf.writeUInt32BE(1320, 16);
  pngBuf.writeUInt32BE(2868, 20);

  const mockApi = async (method: string, path: string) => {
    if (method === 'GET' && path.includes('appStoreVersions?')) {
      return { data: [{ id: 'ver1', attributes: { appStoreState: 'PREPARE_FOR_SUBMISSION' } }] };
    }
    if (method === 'GET' && path.includes('appScreenshotSets')) return { data: [] };
    if (method === 'POST' && path === '/v1/appScreenshotSets') return { data: { id: 'set1' } };
    if (method === 'POST' && path === '/v1/appScreenshots') {
      return {
        data: {
          id: 'shot1',
          attributes: {
            uploadOperations: [
              { url: 'https://upload.example.com/p1', offset: 0, length: 50, requestHeaders: [] },
              { url: 'https://upload.example.com/p2', offset: 50, length: 50, requestHeaders: [] },
            ],
          },
        },
      };
    }
    return {};
  };

  await uploadScreenshots({ api: mockApi, upload: mockUpload, appId: '123', files: [{ name: 'shot.png', data: pngBuf }] });
  assert.equal(uploadCalls.length, 2, 'must call upload once per upload operation');
  assert.equal(uploadCalls[0].url, 'https://upload.example.com/p1');
  assert.equal(uploadCalls[1].url, 'https://upload.example.com/p2');
  assert.equal(uploadCalls[0].data.length, 50, 'first part is bytes 0-49');
  assert.equal(uploadCalls[1].data.length, 50, 'second part is bytes 50-99');
});

// --- still-blocked list completeness ---

test('stillBlockedList covers all human-only fields and keywords-without-submit note', () => {
  const list = stillBlockedList();
  for (const item of ['entered by Tim, unverified by API', 'App Privacy', 'Paid Apps', 'App Compliance', 'ParentalGate']) {
    assert.match(list, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `stillBlockedList missing "${item}"`);
  }
});
