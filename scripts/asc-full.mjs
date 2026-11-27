#!/usr/bin/env node
// Full App Store Connect metadata workflow: metadata | screenshots | submit.
// Used by .github/workflows/apple-metadata.yml.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents). Never printed.
// Usage: node scripts/asc-full.mjs <metadata|screenshots|submit>
// Secrets reach only this script (never printed, cleared after jwt() use).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';
import { validateListingFull, syncFullMetadata, uploadScreenshots, verifyGoComment, createReviewSubmission, dryRunReport, stillBlockedList } from './lib/ascFull.mjs';

const ACTION = process.argv[2];
if (!['metadata', 'screenshots', 'submit'].includes(ACTION)) {
  console.error('Usage: asc-full.mjs <metadata|screenshots|submit>');
  process.exit(2);
}

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APP_ID, APPLY, GO_ISSUE_COMMENT_ID, GITHUB_TOKEN } = process.env;
for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) { console.error(`Missing env var ${k}`); process.exit(2); }
}
if (!/^\d{1,20}$/.test(APP_ID ?? '')) { console.error('APP_ID must be a numeric ASC app id'); process.exit(2); }
const apply = APPLY === 'true';

const listing = JSON.parse(readFileSync('store/ios/listing-final.json', 'utf8'));
const errors = validateListingFull(listing);
if (errors.length) { console.error('Listing is invalid:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`Listing valid. apply=${apply} action=${ACTION}`);
if (apply && listing.approved !== true) {
  console.error('Refusing to apply: "approved" is not true in store/ios/listing-final.json. Tim sets it in a reviewed commit.');
  process.exit(1);
}

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  return `${input}.${b64u(sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }))}`;
}

async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = {}; }
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} → HTTP ${res.status}: ${(json.errors ?? []).map((e) => `${e.code} ${e.detail}`).join('; ') || text.slice(0, 200)}`);
  return json;
}

async function upload(url, data, headers) {
  const res = await fetch(url, { method: 'PUT', headers, body: data });
  if (!res.ok) throw new Error(`Screenshot upload → HTTP ${res.status}`);
}

try {
  if (ACTION === 'metadata') {
    if (apply) {
      const log = await syncFullMetadata({ api, appId: APP_ID, listing, apply: true });
      console.log('APPLIED:');
      console.log(JSON.stringify(log, null, 2));
    } else {
      // Dry run: fetch live values for diff display, then report
      let liveInfo = null;
      try {
        const versions = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
        const ver = versions.find((x) => x.attributes?.appStoreState === 'PREPARE_FOR_SUBMISSION' || x.attributes?.appStoreState?.includes('SUBMIT'));
        if (ver) {
          const locs = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data ?? [];
          const loc = locs.find((x) => x.attributes?.locale === listing.locale);
          liveInfo = { ...loc?.attributes, copyright: ver.attributes?.copyright, releaseType: ver.attributes?.releaseType };
        }
        const infos = (await api('GET', `/v1/apps/${APP_ID}/appInfos`)).data ?? [];
        const info = infos.find((i) => !['READY_FOR_SALE', 'REMOVED_FROM_SALE'].includes(i.attributes?.appStoreState ?? ''));
        if (info) {
          const infoLocs = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data ?? [];
          const infoLoc = infoLocs.find((x) => x.attributes?.locale === listing.locale);
          liveInfo = { ...liveInfo, ...infoLoc?.attributes };
        }
      } catch (e) {
        console.log(`(could not read live values: ${e.message})`);
      }
      console.log(dryRunReport(listing, liveInfo));
      const dryLog = await syncFullMetadata({ api, appId: APP_ID, listing, apply: false });
      console.log('\nDRY RUN planned changes:');
      console.log(JSON.stringify(dryLog, null, 2));
    }
  }

  if (ACTION === 'screenshots') {
    if (!apply) {
      const dir = 'store/ios/screenshots/iphone-6.3';
      let files;
      try { files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort(); }
      catch { files = []; }
      console.log(`DRY RUN — screenshots action`);
      console.log(`  Source: ${dir}`);
      console.log(`  Files found: ${files.length ? files.join(', ') : '(none)'}`);
      console.log(`  Display type: APP_IPHONE_63 (1206×2622, iPhone 16 Pro / 17 Pro 6.3")`);
      console.log('  Re-run with apply=true to upload.');
    } else {
      const dir = 'store/ios/screenshots/iphone-6.3';
      const names = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
      if (!names.length) { console.error(`No PNG files found in ${dir}`); process.exit(1); }
      const files = names.map((name) => ({ name, data: readFileSync(join(dir, name)) }));
      console.log(`Uploading ${files.length} screenshots from ${dir}...`);
      const result = await uploadScreenshots({ api, upload, appId: APP_ID, files });
      console.log('UPLOADED:');
      console.log(JSON.stringify(result, null, 2));
    }
  }

  if (ACTION === 'submit') {
    if (!apply) {
      console.log('DRY RUN — submit action');
      console.log('  Provide apply=true AND a go_issue_comment_id naming an issue 265 comment by timfong888 containing "SUBMIT v1.0".');
      console.log('  The comment must exist before this run.');
    } else {
      if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN is required for the submit go-check'); process.exit(2); }
      console.log(`Verifying go comment id=${GO_ISSUE_COMMENT_ID}...`);
      const goResult = await verifyGoComment({ commentId: GO_ISSUE_COMMENT_ID, fetch, githubToken: GITHUB_TOKEN });
      console.log(`Go check passed: comment ${goResult.commentId} posted at ${goResult.createdAt}`);
      const sub = await createReviewSubmission({ api, appId: APP_ID });
      console.log('REVIEW SUBMISSION CREATED:');
      console.log(JSON.stringify(sub, null, 2));
    }
  }

  console.log('\n' + stillBlockedList());
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
