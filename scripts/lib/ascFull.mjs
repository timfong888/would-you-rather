// Extended App Store Connect operations: review notes, age rating, pricing, IAP attachment,
// release type, screenshot upload, and review submission.
// No network calls here — only pure logic and the api() wrapper. Testable with mocked fetch.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { syncListing, EDITABLE_STATES, LIMITS, validateListing } from './ascMetadata.mjs';

export { LIMITS, EDITABLE_STATES };

/** Every API call this module may make, beyond those in ascMetadata.ALLOWED. */
export const ALLOWED_EXTRA = [
  // age rating
  ['GET',   /^\/v1\/appStoreVersions\/[\w-]+\/ageRatingDeclaration$/],
  ['PATCH', /^\/v1\/ageRatingDeclarations\/[\w-]+$/],
  // review notes (appStoreReviewDetail — notesText only, never contact fields)
  ['GET',   /^\/v1\/appStoreVersions\/[\w-]+\/appStoreReviewDetail$/],
  ['POST',  /^\/v1\/appStoreReviewDetails$/],
  ['PATCH', /^\/v1\/appStoreReviewDetails\/[\w-]+$/],
  // version release type + category on appInfo
  ['GET',   /^\/v1\/apps\/\d+\/appStoreVersions/],
  ['PATCH', /^\/v1\/appInfos\/[\w-]+$/],
  // pricing (read + write price schedule)
  ['GET',   /^\/v1\/apps\/\d+\/appPriceSchedule$/],
  ['GET',   /^\/v1\/apps\/\d+\/appPricePoints\?/],
  ['POST',  /^\/v1\/appPriceSchedules$/],
  // availability (US-only territories)
  ['GET',   /^\/v1\/apps\/\d+\/appAvailabilityV2$/],
  ['POST',  /^\/v1\/appAvailabilityV2$/],
  ['GET',   /^\/v1\/territories\?/],
  // IAP attachment to version
  ['GET',   /^\/v1\/apps\/\d+\/inAppPurchasesV2(\?.*)?$/],
  ['GET',   /^\/v1\/appStoreVersions\/[\w-]+\/inAppPurchasesV2(\?.*)?$/],
  ['POST',  /^\/v1\/appStoreVersions\/[\w-]+\/relationships\/inAppPurchasesV2$/],
  // screenshots
  ['GET',   /^\/v1\/appStoreVersions\/[\w-]+\/appScreenshotSets(\?.*)?$/],
  ['POST',  /^\/v1\/appScreenshotSets$/],
  ['POST',  /^\/v1\/appScreenshots$/],
  ['PATCH', /^\/v1\/appScreenshots\/[\w-]+$/],
  // review submission
  ['GET',   /^\/v1\/apps\/\d+\/reviewSubmissions(\?.*)?$/],
  ['POST',  /^\/v1\/reviewSubmissions$/],
  ['POST',  /^\/v1\/reviewSubmissionItems$/],
];

export const SCREENSHOT_DISPLAY_TYPE = 'APP_IPHONE_63'; // 1206×2622 — iPhone 16 Pro / 17 Pro 6.3"

/** Validate the extended listing fields (age rating, review notes, etc.). */
export function validateListingFull(l) {
  const errors = validateListing(l);
  if (l.reviewNotes != null) {
    if (typeof l.reviewNotes !== 'string' || !l.reviewNotes.trim()) errors.push('reviewNotes must be a non-empty string when present');
    else if ([...l.reviewNotes].length > 4000) errors.push(`reviewNotes is ${[...l.reviewNotes].length} chars, limit 4000`);
  }
  if (l.ageRatingDeclaration != null && typeof l.ageRatingDeclaration !== 'object') {
    errors.push('ageRatingDeclaration must be an object when present');
  }
  if (l.releaseType != null && !['MANUAL', 'AFTER_APPROVAL'].includes(l.releaseType)) {
    errors.push('releaseType must be MANUAL or AFTER_APPROVAL');
  }
  if (l.territories != null && (!Array.isArray(l.territories) || !l.territories.every((t) => typeof t === 'string'))) {
    errors.push('territories must be an array of strings');
  }
  if (l.price != null && typeof l.price !== 'number') {
    errors.push('price must be a number (0 = free)');
  }
  return errors;
}

/**
 * Print a dry-run table: for each field, show proposed value, character count, and current live value.
 * Returns a string suitable for console.log output.
 */
export function dryRunReport(listing, liveInfo) {
  const lines = ['DRY RUN — proposed values vs live App Store Connect\n'];
  const len = (v) => (v == null ? '' : `${[...String(v)].length} chars`);

  const rows = [
    // appInfo fields
    { field: 'name (appInfo)',           limit: 30,   proposed: listing.appInfo?.name,            live: liveInfo?.name },
    { field: 'subtitle (appInfo)',       limit: 30,   proposed: listing.appInfo?.subtitle,         live: liveInfo?.subtitle },
    { field: 'privacyPolicyUrl',         limit: null, proposed: listing.appInfo?.privacyPolicyUrl, live: liveInfo?.privacyPolicyUrl },
    // version text fields
    { field: 'description',             limit: 4000, proposed: listing.version?.description,      live: liveInfo?.description },
    { field: 'promotionalText',         limit: 170,  proposed: listing.version?.promotionalText,  live: liveInfo?.promotionalText },
    { field: 'keywords',                limit: 100,  proposed: listing.version?.keywords ?? '(pending — not written)', live: liveInfo?.keywords },
    { field: 'supportUrl',              limit: null, proposed: listing.version?.supportUrl,       live: liveInfo?.supportUrl },
    { field: 'marketingUrl',            limit: null, proposed: listing.version?.marketingUrl,     live: liveInfo?.marketingUrl },
    { field: 'whatsNew',                limit: 4000, proposed: listing.version?.whatsNew ?? '(null — skipped)', live: liveInfo?.whatsNew },
    { field: 'copyright',               limit: 200,  proposed: listing.version?.copyright,        live: liveInfo?.copyright },
    // new fields
    { field: 'primaryCategory',         limit: null, proposed: listing.appInfo?.primaryCategory ?? '(null — skipped)', live: liveInfo?.primaryCategory ?? '(unverified)' },
    { field: 'secondaryCategory',       limit: null, proposed: listing.appInfo?.secondaryCategory ?? '(null — Tim decides)', live: liveInfo?.secondaryCategory ?? '(unverified)' },
    { field: 'reviewNotes',             limit: 4000, proposed: listing.reviewNotes ?? '(null — skipped)', live: liveInfo?.reviewNotes },
    { field: 'ageRatingDeclaration',    limit: null, proposed: listing.ageRatingDeclaration ? JSON.stringify(listing.ageRatingDeclaration) : '(null — skipped)', live: liveInfo?.ageRatingDeclaration ? '(set — unreadable via GET)' : '(unverified)' },
    { field: 'releaseType',             limit: null, proposed: listing.releaseType ?? '(null — skipped)', live: liveInfo?.releaseType },
    { field: 'territories',             limit: null, proposed: listing.territories ? JSON.stringify(listing.territories) : '(null — skipped)', live: liveInfo?.territories ? JSON.stringify(liveInfo.territories) : '(unverified)' },
    { field: 'price',                   limit: null, proposed: listing.price != null ? `${listing.price} (free = 0)` : '(null — skipped)', live: liveInfo?.price != null ? String(liveInfo.price) : '(unverified)' },
    { field: 'attachAllIap',            limit: null, proposed: listing.attachAllIap ? 'yes — attach all 8 IAPs' : 'no', live: liveInfo?.iapCount != null ? `${liveInfo.iapCount} attached` : '(unverified)' },
  ];

  for (const r of rows) {
    const proposed = r.proposed == null ? '(null)' : String(r.proposed);
    const count = r.limit ? ` [${len(r.proposed)}/${r.limit}]` : '';
    const live = r.live == null ? '(unknown)' : String(r.live);
    // Truncate long values for readability
    const display = proposed.length > 120 ? proposed.slice(0, 117) + '...' : proposed;
    lines.push(`  ${r.field}${count}:`);
    lines.push(`    proposed: ${display}`);
    lines.push(`    live:     ${live.length > 120 ? live.slice(0, 117) + '...' : live}`);
  }

  return lines.join('\n');
}

/**
 * Sync all metadata fields: text (via syncListing) + review notes, age rating,
 * release type, price (free), US-only availability, IAP attachment.
 * apply=false → dry run only.
 */
export async function syncFullMetadata({ api, appId, listing, apply }) {
  const log = await syncListing({ api, appId, listing, apply });

  // Fetch the editable version id (syncListing already verified one exists)
  const versions = (await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
  const ver = versions.find((x) => EDITABLE_STATES.includes(x.attributes?.appStoreState));
  if (!ver) throw new Error('No editable iOS version found (should have been caught earlier)');

  // --- primary category (on appInfo, not appInfoLocalization) ---
  if (listing.appInfo?.primaryCategory != null) {
    const infos = (await api('GET', `/v1/apps/${appId}/appInfos`)).data ?? [];
    const info = infos.find((i) => EDITABLE_STATES.includes(i.attributes?.appStoreState));
    if (info) {
      const relationships = { primaryCategory: { data: { type: 'appCategories', id: listing.appInfo.primaryCategory } } };
      if (listing.appInfo.secondaryCategory) relationships.secondaryCategory = { data: { type: 'appCategories', id: listing.appInfo.secondaryCategory } };
      log.push({ target: 'appInfo', action: apply ? 'update' : 'would update', fields: ['primaryCategory', ...(listing.appInfo.secondaryCategory ? ['secondaryCategory'] : [])] });
      if (apply) await api('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships } });
    }
  }

  // --- release type ---
  if (listing.releaseType != null) {
    const current = ver.attributes?.releaseType;
    if (current !== listing.releaseType) {
      log.push({ target: 'appStoreVersion', action: apply ? 'update' : 'would update', fields: ['releaseType'], from: current, to: listing.releaseType });
      if (apply) await api('PATCH', `/v1/appStoreVersions/${ver.id}`, { data: { type: 'appStoreVersions', id: ver.id, attributes: { releaseType: listing.releaseType } } });
    } else {
      log.push({ target: 'appStoreVersion', action: 'no-change', fields: ['releaseType'], value: current });
    }
  }

  // --- review notes ---
  if (listing.reviewNotes != null) {
    const detailRes = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`);
    const detail = detailRes.data;
    if (!detail) {
      log.push({ target: 'appStoreReviewDetail', action: apply ? 'create' : 'would create', fields: ['notesText'] });
      if (apply) await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes: { notesText: listing.reviewNotes }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
    } else {
      const current = detail.attributes?.notesText ?? null;
      if (current !== listing.reviewNotes) {
        log.push({ target: 'appStoreReviewDetail', action: apply ? 'update' : 'would update', fields: ['notesText'] });
        if (apply) await api('PATCH', `/v1/appStoreReviewDetails/${detail.id}`, { data: { type: 'appStoreReviewDetails', id: detail.id, attributes: { notesText: listing.reviewNotes } } });
      } else {
        log.push({ target: 'appStoreReviewDetail', action: 'no-change', fields: ['notesText'] });
      }
    }
  }

  // --- age rating declaration ---
  if (listing.ageRatingDeclaration != null) {
    const ardRes = await api('GET', `/v1/appStoreVersions/${ver.id}/ageRatingDeclaration`);
    const ard = ardRes.data;
    if (!ard) {
      log.push({ target: 'ageRatingDeclaration', action: 'not-found', note: 'no ageRatingDeclaration on this version — skipped' });
    } else {
      const attrs = listing.ageRatingDeclaration;
      log.push({ target: 'ageRatingDeclaration', action: apply ? 'update' : 'would update', fields: Object.keys(attrs) });
      if (apply) await api('PATCH', `/v1/ageRatingDeclarations/${ard.id}`, { data: { type: 'ageRatingDeclarations', id: ard.id, attributes: attrs } });
    }
  }

  // --- price (free, tier 0) ---
  if (listing.price === 0) {
    log.push({ target: 'appPriceSchedule', action: apply ? 'ensure-free' : 'would ensure-free', note: 'GET /v1/apps/{id}/appPriceSchedule to verify; write if not free' });
    if (apply) {
      const schedRes = await api('GET', `/v1/apps/${appId}/appPriceSchedule`);
      const sched = schedRes.data;
      if (!sched) {
        // No schedule yet — create a free one with USA as base territory
        const ptRes = await api('GET', `/v1/apps/${appId}/appPricePoints?filter[territory]=USA&filter[customerPrice]=0.00&limit=1`);
        const pt = ptRes.data?.[0];
        if (!pt) throw new Error('Could not find free price point for USA — verify territory code or price point API');
        await api('POST', '/v1/appPriceSchedules', { data: { type: 'appPriceSchedules', relationships: { app: { data: { type: 'apps', id: appId } }, baseTerritory: { data: { type: 'territories', id: 'USA' } }, manualPrices: { data: [{ type: 'appPricePoints', id: pt.id }] } } } });
        log.push({ target: 'appPriceSchedule', action: 'created', priceTier: 0, territory: 'USA' });
      } else {
        log.push({ target: 'appPriceSchedule', action: 'exists', note: 'schedule present — verify price is free in ASC UI' });
      }
    }
  }

  // --- availability (US-only) ---
  if (Array.isArray(listing.territories) && listing.territories.length > 0) {
    log.push({ target: 'appAvailability', action: apply ? 'set-territories' : 'would set-territories', territories: listing.territories });
    if (apply) {
      const avRes = await api('GET', `/v1/apps/${appId}/appAvailabilityV2`);
      const av = avRes.data;
      const territoryData = listing.territories.map((t) => ({ type: 'territories', id: t }));
      if (!av) {
        await api('POST', '/v1/appAvailabilityV2', { data: { type: 'appAvailabilityV2', attributes: { availableInNewTerritories: false }, relationships: { app: { data: { type: 'apps', id: appId } }, availableTerritories: { data: territoryData } } } });
      } else {
        log.push({ target: 'appAvailability', action: 'exists', note: 'availability record exists — verify territories in ASC UI; API update skipped (would remove storefronts)' });
      }
    }
  }

  // --- IAP attachment ---
  if (listing.attachAllIap) {
    const iapRes = await api('GET', `/v1/apps/${appId}/inAppPurchasesV2?limit=50`);
    const iaps = iapRes.data ?? [];
    const readyIds = iaps.filter((p) => p.attributes?.state === 'READY_TO_SUBMIT').map((p) => p.id);
    log.push({ target: 'inAppPurchases', action: apply ? 'attach' : 'would attach', count: readyIds.length, state: 'READY_TO_SUBMIT' });
    if (apply && readyIds.length > 0) {
      await api('POST', `/v1/appStoreVersions/${ver.id}/relationships/inAppPurchasesV2`, { data: readyIds.map((id) => ({ type: 'inAppPurchases', id })) });
    }
  }

  return log;
}

/**
 * Upload screenshots from a directory to an appScreenshotSet for the editable iOS version.
 * files: array of { name: string, data: Buffer } already sorted by filename.
 */
export async function uploadScreenshots({ api, upload, appId, files }) {
  if (!files.length) throw new Error('No screenshot files found in store/ios/screenshots/iphone-6.3/');

  const versions = (await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
  const ver = versions.find((x) => EDITABLE_STATES.includes(x.attributes?.appStoreState));
  if (!ver) throw new Error('No editable iOS version found');

  // Find or create the screenshot set for APP_IPHONE_63
  const setRes = await api('GET', `/v1/appStoreVersions/${ver.id}/appScreenshotSets?filter[screenshotDisplayType]=${SCREENSHOT_DISPLAY_TYPE}`);
  let setId = setRes.data?.[0]?.id;
  if (!setId) {
    const created = await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: SCREENSHOT_DISPLAY_TYPE }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
    setId = created.data?.id;
    if (!setId) throw new Error('Failed to create appScreenshotSet');
  }

  const log = [];
  for (const file of files) {
    const md5 = createHash('md5').update(file.data).digest('base64');
    // Reserve the slot
    const reserve = await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName: file.name, fileSize: file.data.length }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } } } } });
    const reserved = reserve.data;
    if (!reserved) throw new Error(`Failed to reserve slot for ${file.name}`);
    // Upload to the provided URL (Content-Type: image/png, Content-MD5: base64 of MD5)
    const op = reserved.attributes?.uploadOperations?.[0];
    if (!op?.url) throw new Error(`No upload URL for ${file.name}`);
    await upload(op.url, file.data, { 'Content-Type': 'image/png', 'Content-MD5': md5, ...Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value])) });
    // Commit
    await api('PATCH', `/v1/appScreenshots/${reserved.id}`, { data: { type: 'appScreenshots', id: reserved.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
    log.push({ file: file.name, screenshotId: reserved.id, bytes: file.data.length });
  }
  return { setId, screenshots: log };
}

/**
 * Verify that a GitHub issue comment satisfies the go condition for submit.
 * Returns { ok: true } or throws with a reason.
 * fetch: standard fetch or mock.
 */
export async function verifyGoComment({ commentId, fetch, githubToken }) {
  if (!commentId || !String(commentId).trim()) throw new Error('go_issue_comment_id is required for the submit action');
  const id = String(commentId).trim();
  if (!/^\d+$/.test(id)) throw new Error(`go_issue_comment_id must be a numeric comment id, got: ${id}`);

  const res = await fetch(`https://api.github.com/repos/timfong888/would-you-rather/issues/comments/${id}`, {
    headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'asc-full/1', Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (res.status === 404) throw new Error(`Comment ${id} not found — verify the comment ID on issue 265`);
  if (!res.ok) throw new Error(`GitHub API error ${res.status} fetching comment ${id}`);
  const comment = await res.json();

  // Must be on issue 265
  const issueUrl = comment.issue_url ?? '';
  if (!issueUrl.endsWith('/issues/265')) throw new Error(`Comment ${id} is not on issue 265 (issue_url: ${issueUrl})`);
  // Must be by timfong888
  const login = comment.user?.login ?? '';
  if (login !== 'timfong888') throw new Error(`Comment ${id} was posted by ${login}, not timfong888`);
  // Must contain exact text "SUBMIT v1.0"
  if (!String(comment.body ?? '').includes('SUBMIT v1.0')) throw new Error(`Comment ${id} does not contain "SUBMIT v1.0"`);

  return { ok: true, commentId: id, createdAt: comment.created_at };
}

/**
 * Create a reviewSubmission for the editable iOS version.
 * Returns the submission id.
 */
export async function createReviewSubmission({ api, appId }) {
  const versions = (await api('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
  const ver = versions.find((x) => EDITABLE_STATES.includes(x.attributes?.appStoreState));
  if (!ver) throw new Error('No editable iOS version found — cannot create review submission');

  // Check for existing open submission
  const existingRes = await api('GET', `/v1/apps/${appId}/reviewSubmissions?filter[platform]=IOS&limit=5`);
  const open = (existingRes.data ?? []).find((s) => !['COMPLETE', 'CANCELING'].includes(s.attributes?.state ?? ''));
  if (open) throw new Error(`A review submission already exists in state ${open.attributes?.state} (id: ${open.id}). Cancel it in ASC before creating a new one.`);

  const sub = await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: appId } } } } });
  const subId = sub.data?.id;
  if (!subId) throw new Error('Failed to create reviewSubmission (no id returned)');

  // Add the app store version as a submission item
  await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: { data: { type: 'reviewSubmissions', id: subId } }, appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });

  return { submissionId: subId, versionId: ver.id, versionString: ver.attributes?.versionString };
}

/**
 * Print the "still blocked" checklist — things the script cannot touch.
 */
export function stillBlockedList() {
  return [
    '--- STILL BLOCKED (manual steps required) ---',
    '1. App Review contact name, last name, phone number — personal data, never stored in files',
    '2. App Review email — confirm tim@wouldyourather.fyi or personal address',
    '3. App Privacy (nutrition label) — answer data-type questions in ASC > App Privacy',
    '4. Paid Apps agreement, banking and tax forms — Account Holder only at appstoreconnect.apple.com/business',
    '5. App Compliance section — open in ASC left menu; read each question to the agent to fill',
    '6. EU trader status — not expected for US-only, but verify inside App Compliance',
    '7. Keywords — leave blank until Tim supplies Search Ads data (see spec 8.5)',
    '8. ParentalGate.tsx in build 23 — verify on a device before sending review notes',
    '9. Price / territories write — if the apply run logs "schedule exists", verify free and US-only in ASC UI',
    '10. IAP attachment — if the POST /relationships/inAppPurchasesV2 fails, attach manually in version page',
  ].join('\n');
}
