import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import { validateListing, syncListing, ALLOWED } from '../../scripts/lib/ascMetadata.mjs';

const listing = JSON.parse(readFileSync('store/ios/listing-final.json', 'utf8'));

function fakeApi(opts: { infoState?: string; verState?: string; withLocs?: boolean } = {}) {
  const calls: string[] = [];
  const api = async (method: string, path: string, body?: any) => {
    calls.push(`${method} ${path.split('?')[0]}`);
    if (method === 'GET' && /appInfos$/.test(path)) return { data: [{ id: 'i1', attributes: { appStoreState: opts.infoState ?? 'PREPARE_FOR_SUBMISSION' } }] };
    if (method === 'GET' && /appInfoLocalizations$/.test(path)) return { data: opts.withLocs ? [{ id: 'il1', attributes: { locale: 'en-US', name: 'Old', subtitle: 'Old', privacyPolicyUrl: null } }] : [] };
    if (method === 'GET' && /appStoreVersions\?|appStoreVersions$/.test(path)) return { data: [{ id: 'v1', attributes: { appStoreState: opts.verState ?? 'PREPARE_FOR_SUBMISSION', versionString: '1.0.0', copyright: null } }] };
    if (method === 'GET' && /appStoreVersionLocalizations$/.test(path)) return { data: opts.withLocs ? [{ id: 'vl1', attributes: { locale: 'en-US', description: 'old' } }] : [] };
    return { data: {} };
  };
  return { api, calls };
}

test('the committed listing is valid and not yet approved', () => {
  assert.deepEqual(validateListing(listing), []);
  assert.equal(listing.approved, false);
});

test('limits and kids wording are enforced', () => {
  const bad = structuredClone(listing);
  bad.appInfo.name = 'x'.repeat(31);
  bad.version.keywords = 'game,kids';
  bad.version.promotionalText = 'y'.repeat(171);
  bad.version.supportUrl = 'http://insecure.example';
  const errs = validateListing(bad).join('\n');
  assert.match(errs, /name is 31 chars/);
  assert.match(errs, /keywords must not use "kids"/);
  assert.match(errs, /promotionalText is 171/);
  assert.match(errs, /supportUrl must be an https URL/);
});

test('dry run reads but never writes', async () => {
  for (const withLocs of [false, true]) {
    const { api, calls } = fakeApi({ withLocs });
    const log = await syncListing({ api, appId: '1', listing, apply: false });
    assert.ok(log.length >= 1);
    assert.ok(calls.every((c) => c.startsWith('GET ')), calls.join(' | '));
  }
});

test('apply writes only localization and copyright endpoints', async () => {
  const { api, calls } = fakeApi({ withLocs: true });
  await syncListing({ api, appId: '1', listing, apply: true });
  const writes = calls.filter((c) => !c.startsWith('GET '));
  assert.ok(writes.length >= 2);
  for (const w of writes) {
    assert.match(w, /^(PATCH|POST) \/v1\/(appInfoLocalizations|appStoreVersionLocalizations|appStoreVersions)(\/[\w-]+)?$/);
  }
  assert.ok(!calls.some((c) => /submission|reviewSubmission|screenshot|build|ageRating|price/i.test(c)));
});

test('refuses versions that are in review or released', async () => {
  const { api } = fakeApi({ verState: 'IN_REVIEW' });
  await assert.rejects(syncListing({ api, appId: '1', listing, apply: true }), /No editable iOS version/);
});

test('no allowed call can submit for review', () => {
  for (const [, re] of ALLOWED) assert.doesNotMatch(String(re), /submission|reviewSubmissions|screenshot|builds/i);
});

test('ALLOWED excludes review submission and age-rating writes', async () => {
  assert.ok(!ALLOWED.some(([m, re]: any[]) => m === 'POST' && re.test('/v1/reviewSubmissions')));
  assert.ok(!ALLOWED.some(([m, re]: any[]) => m === 'PATCH' && re.test('/v1/ageRatingDeclarations/1')));
});

test('the workflow is dry run by default and manual only', () => {
  const wf = readFileSync('.github/workflows/apple-metadata.yml', 'utf8');
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /apply:[\s\S]*?default: false/);
  assert.doesNotMatch(wf, /\n  (push|pull_request|schedule):/);
});
