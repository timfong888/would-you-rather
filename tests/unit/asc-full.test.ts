import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// @ts-ignore plain .mjs modules
import { validateListingFull, dryRunReport, verifyGoComment, stillBlockedList, SCREENSHOT_DISPLAY_TYPE } from '../../scripts/lib/ascFull.mjs';
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

test('name (28) and subtitle (30) are within limits', () => {
  assert.ok([...listing.appInfo.name].length <= 30);
  assert.ok([...listing.appInfo.subtitle].length <= 30);
});

test('name, subtitle and keywords have no "kids" or "children"', () => {
  for (const v of [listing.appInfo.name, listing.appInfo.subtitle]) {
    assert.doesNotMatch(v, /\bkids?\b|\bchildren\b/i);
  }
  // keywords is null (pending), so no check needed there
  assert.equal(listing.version.keywords, null, 'keywords must be null until Tim supplies Search Ads data');
});

test('no repeated words between name and subtitle (case-insensitive)', () => {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const nameWords = new Set(words(listing.appInfo.name));
  const subWords = words(listing.appInfo.subtitle);
  // "family" appears in both — this is an accepted trade-off per Tim's decision (8.8 D4); we just document it
  const repeats = subWords.filter((w) => nameWords.has(w) && w !== 'family');
  assert.deepEqual(repeats, [], `unexpected repeated words between name and subtitle: ${repeats.join(', ')}`);
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
  for (const field of ['name (appInfo)', 'description', 'promotionalText', 'keywords', 'reviewNotes', 'ageRatingDeclaration', 'releaseType', 'territories', 'price', 'attachAllIap']) {
    assert.match(report, new RegExp(field.replace(/[()]/g, '\\$&')), `field "${field}" missing from dry-run report`);
  }
});

test('dryRunReport marks keywords as pending when null', () => {
  const report = dryRunReport(listing, null);
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

test('screenshot display type is APP_IPHONE_63 for 1206x2622', () => {
  assert.equal(SCREENSHOT_DISPLAY_TYPE, 'APP_IPHONE_63');
});

// --- still-blocked list completeness ---

test('stillBlockedList covers all human-only fields', () => {
  const list = stillBlockedList();
  for (const item of ['contact', 'App Privacy', 'Paid Apps', 'App Compliance', 'Keywords', 'ParentalGate']) {
    assert.match(list, new RegExp(item, 'i'), `stillBlockedList missing "${item}"`);
  }
});
