// tests/unit/highersignal-signing.test.ts
// Pure-function and cleanup tests for scripts/highersignal-signing.mjs.
// What is covered here: request bodies, the 3-certificate stop, response parsers, cleanup on failure.
// What only a real run can verify: openssl is available, the ASC key has Admin role, Apple accepts
//   the CSR, the bundle ID sophia.pkg is registered, EAS picks up credentials.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// @ts-ignore plain .mjs module
import {
  checkCertLimit,
  buildCertificateBody,
  buildProfileBody,
  buildCredentialsJson,
  patchEasJson,
  parseCertResult,
  parseProfileResult,
  parseBundleIdResult,
  deleteResources,
} from '../../scripts/highersignal-signing.mjs';

const wfRaw = readFileSync('.github/workflows/highersignal-ios-testflight.yml', 'utf8');
const wf = wfRaw.split('\n').filter((l: string) => !/^\s*#/.test(l)).join('\n');
const wfSteps = wf.split(/\n      - /).slice(1);

// ── checkCertLimit ─────────────────────────────────────────────────────────────

test('checkCertLimit: 0, 1, 2 certs allowed; 3 or more of any DISTRIBUTION type throw', () => {
  const cert = (type: string, id = type) => ({ id, attributes: { certificateType: type } });
  assert.equal(checkCertLimit([]), 0);
  assert.equal(checkCertLimit([cert('IOS_DISTRIBUTION')]), 1);
  assert.equal(checkCertLimit([cert('DISTRIBUTION')]), 1);
  assert.equal(checkCertLimit([cert('IOS_DISTRIBUTION'), cert('DISTRIBUTION')]), 2);
  // exactly 3 → stop
  assert.throws(
    () => checkCertLimit([cert('IOS_DISTRIBUTION', 'c1'), cert('IOS_DISTRIBUTION', 'c2'), cert('IOS_DISTRIBUTION', 'c3')]),
    /3 IOS_DISTRIBUTION/,
  );
  assert.throws(
    () => checkCertLimit([cert('IOS_DISTRIBUTION', 'a'), cert('DISTRIBUTION', 'b'), cert('DISTRIBUTION', 'c')]),
    /3 IOS_DISTRIBUTION/,
  );
  // 4 or more also throw
  assert.throws(
    () => checkCertLimit([cert('IOS_DISTRIBUTION', '1'), cert('IOS_DISTRIBUTION', '2'), cert('IOS_DISTRIBUTION', '3'), cert('IOS_DISTRIBUTION', '4')]),
    /4 IOS_DISTRIBUTION/,
  );
});

test('checkCertLimit: other cert types are not counted (only DISTRIBUTION ones)', () => {
  const cert = (type: string) => ({ id: type, attributes: { certificateType: type } });
  assert.equal(checkCertLimit([cert('MAC_APP_DISTRIBUTION'), cert('IOS_DEVELOPMENT'), cert('MAC_INSTALLER_DISTRIBUTION')]), 0);
  assert.equal(checkCertLimit([cert('IOS_DISTRIBUTION'), cert('MAC_APP_DISTRIBUTION'), cert('IOS_DEVELOPMENT')]), 1);
});

test('checkCertLimit: null/undefined/malformed entries are ignored', () => {
  assert.equal(checkCertLimit(null), 0);
  assert.equal(checkCertLimit(undefined), 0);
  assert.equal(checkCertLimit([null, {}, { attributes: null }, { attributes: { certificateType: null } }]), 0);
});

test('checkCertLimit: error message includes cert IDs (so caller knows which ones to revoke)', () => {
  const certs = ['c1', 'c2', 'c3'].map((id) => ({ id, attributes: { certificateType: 'IOS_DISTRIBUTION' } }));
  let msg = '';
  try { checkCertLimit(certs); } catch (e: any) { msg = e.message; }
  assert.match(msg, /c1/);
  assert.match(msg, /c2/);
  assert.match(msg, /c3/);
});

// ── buildCertificateBody ───────────────────────────────────────────────────────

test('buildCertificateBody: POST /v1/certificates body has correct type, certificateType and csrContent', () => {
  const body = buildCertificateBody('CSR_PEM_CONTENT');
  assert.equal(body.data.type, 'certificates');
  assert.equal(body.data.attributes.certificateType, 'IOS_DISTRIBUTION');
  assert.equal(body.data.attributes.csrContent, 'CSR_PEM_CONTENT');
  // serialisable – JSON.stringify must not throw
  assert.doesNotThrow(() => JSON.stringify(body));
});

// ── buildProfileBody ───────────────────────────────────────────────────────────

test('buildProfileBody: POST /v1/profiles body has correct type, profileType and relationships', () => {
  const body = buildProfileBody('BUNDLE_ID_RES', 'CERT_ID_RES', 'My CI Profile');
  assert.equal(body.data.type, 'profiles');
  assert.equal(body.data.attributes.profileType, 'IOS_APP_STORE');
  assert.equal(body.data.attributes.name, 'My CI Profile');
  assert.equal(body.data.relationships.bundleId.data.id, 'BUNDLE_ID_RES');
  assert.equal(body.data.relationships.bundleId.data.type, 'bundleIds');
  assert.deepEqual(body.data.relationships.certificates.data, [{ id: 'CERT_ID_RES', type: 'certificates' }]);
  assert.deepEqual(body.data.relationships.devices.data, []);
  assert.doesNotThrow(() => JSON.stringify(body));
});

// ── buildCredentialsJson ───────────────────────────────────────────────────────

test('buildCredentialsJson: correct EAS local credentials structure with file paths', () => {
  const creds = buildCredentialsJson('/tmp/dist.p12', 'secretpass', '/tmp/profile.mobileprovision');
  assert.equal(creds.ios.distributionCertificate.path, '/tmp/dist.p12');
  assert.equal(creds.ios.distributionCertificate.password, 'secretpass');
  assert.equal(creds.ios.provisioningProfilePath, '/tmp/profile.mobileprovision');
});

// ── patchEasJson ───────────────────────────────────────────────────────────────

test('patchEasJson: adds credentialsSource: local to named profile without mutating original', () => {
  const eas = { build: { production: { distribution: 'store', autoIncrement: true } } };
  const out = patchEasJson(eas, 'production');
  assert.equal(out.build.production.credentialsSource, 'local');
  assert.equal(out.build.production.distribution, 'store');
  assert.equal(out.build.production.autoIncrement, true);
  assert.equal((eas as any).build.production.credentialsSource, undefined, 'original must not be mutated');
});

test('patchEasJson: creates missing build section and profile if absent', () => {
  const out = patchEasJson({}, 'production');
  assert.equal(out.build.production.credentialsSource, 'local');
});

test('patchEasJson: overwrites an existing credentialsSource (e.g. remote → local)', () => {
  const eas = { build: { production: { credentialsSource: 'remote' } } };
  const out = patchEasJson(eas, 'production');
  assert.equal(out.build.production.credentialsSource, 'local');
});

// ── parseCertResult ────────────────────────────────────────────────────────────

test('parseCertResult: extracts id and certificateContent from 201 response', () => {
  const body = { data: { id: 'CERTABC', attributes: { certificateContent: 'BASE64CONTENT' } } };
  const r = parseCertResult(body, 201);
  assert.equal(r.id, 'CERTABC');
  assert.equal(r.certificateContent, 'BASE64CONTENT');
});

test('parseCertResult: 403 throws with the exact Apple error code and "needs Admin role"', () => {
  const body = { errors: [{ status: '403', code: 'FORBIDDEN', detail: 'Insufficient privileges to perform an administrative action.' }] };
  let msg = '';
  try { parseCertResult(body, 403); } catch (e: any) { msg = e.message; }
  assert.match(msg, /FORBIDDEN/);
  assert.match(msg, /needs Admin role/);
  assert.match(msg, /Insufficient privileges/);
});

test('parseCertResult: 403 via err.status field (not HTTP status) also adds "needs Admin role"', () => {
  const body = { errors: [{ status: '403', code: 'CERT.FORBIDDEN', detail: 'No cert permission.' }] };
  assert.throws(() => parseCertResult(body, 403), /needs Admin role/);
});

test('parseCertResult: non-201/non-403 throws with status and code', () => {
  const body400 = { errors: [{ code: 'ENTITY.INVALID', detail: 'CSR is invalid.' }] };
  assert.throws(() => parseCertResult(body400, 400), /ENTITY\.INVALID/);
  assert.throws(() => parseCertResult(body400, 400), /CSR is invalid/);
  assert.doesNotThrow(() => parseCertResult({ data: { id: 'x', attributes: { certificateContent: 'y' } } }, 201));
});

test('parseCertResult: missing data.id or missing certificateContent throws', () => {
  assert.throws(() => parseCertResult({ data: { attributes: { certificateContent: 'x' } } }, 201), /missing data\.id/);
  assert.throws(() => parseCertResult({ data: { id: 'x', attributes: {} } }, 201), /missing certificateContent/);
  assert.throws(() => parseCertResult({}, 201), /missing data\.id/);
});

// ── parseProfileResult ─────────────────────────────────────────────────────────

test('parseProfileResult: extracts id and profileContent from 201 response', () => {
  const body = { data: { id: 'PROFXYZ', attributes: { profileContent: 'BASE64PROFILE' } } };
  const r = parseProfileResult(body, 201);
  assert.equal(r.id, 'PROFXYZ');
  assert.equal(r.profileContent, 'BASE64PROFILE');
});

test('parseProfileResult: non-201 throws with code and detail', () => {
  const body = { errors: [{ code: 'NOT_FOUND', detail: 'Resource not found.' }] };
  assert.throws(() => parseProfileResult(body, 404), /NOT_FOUND/);
  assert.throws(() => parseProfileResult(body, 404), /Resource not found/);
});

test('parseProfileResult: missing data.id or profileContent throws', () => {
  assert.throws(() => parseProfileResult({ data: { attributes: { profileContent: 'x' } } }, 201), /missing data\.id/);
  assert.throws(() => parseProfileResult({ data: { id: 'x', attributes: {} } }, 201), /missing profileContent/);
});

// ── parseBundleIdResult ────────────────────────────────────────────────────────

test('parseBundleIdResult: finds matching bundle identifier among multiple rows', () => {
  const body = {
    data: [
      { id: 'BID1', attributes: { identifier: 'other.app.id' } },
      { id: 'BID2', attributes: { identifier: 'sophia.pkg' } },
    ],
  };
  assert.equal(parseBundleIdResult(body, 200, 'sophia.pkg'), 'BID2');
});

test('parseBundleIdResult: single-object data (non-array) is also checked', () => {
  const body = { data: { id: 'BID3', attributes: { identifier: 'sophia.pkg' } } };
  assert.equal(parseBundleIdResult(body, 200, 'sophia.pkg'), 'BID3');
});

test('parseBundleIdResult: throws when bundle ID is not found', () => {
  assert.throws(() => parseBundleIdResult({ data: [] }, 200, 'sophia.pkg'), /not found/);
  assert.throws(() => parseBundleIdResult({ data: [{ id: 'x', attributes: { identifier: 'other.app' } }] }, 200, 'sophia.pkg'), /not found/);
  assert.doesNotThrow(() => parseBundleIdResult({ data: [{ id: 'y', attributes: { identifier: 'sophia.pkg' } }] }, 200, 'sophia.pkg'));
});

test('parseBundleIdResult: non-200 HTTP status throws', () => {
  assert.throws(() => parseBundleIdResult({}, 403, 'sophia.pkg'), /failed HTTP 403/);
  assert.throws(() => parseBundleIdResult({}, 500, 'sophia.pkg'), /failed HTTP 500/);
});

// ── deleteResources (cleanup) ──────────────────────────────────────────────────

test('deleteResources: deletes profile before cert', async () => {
  const deleted: string[] = [];
  await deleteResources({
    del: async (p: string) => { deleted.push(p); },
    certId: 'C1', profileId: 'P1',
  });
  assert.ok(deleted[0].includes('/profiles/P1'), `first delete should be profile; got: ${deleted[0]}`);
  assert.ok(deleted[1].includes('/certificates/C1'), `second delete should be cert; got: ${deleted[1]}`);
});

test('deleteResources: cert is still deleted even when profile delete throws', async () => {
  const deleted: string[] = [];
  const mockDel = async (p: string) => {
    deleted.push(p);
    if (p.includes('/profiles/')) throw new Error('profile delete failed');
  };
  await assert.doesNotReject(() => deleteResources({ del: mockDel, certId: 'C1', profileId: 'P1' }));
  assert.ok(deleted.some((p: string) => p.includes('/certificates/C1')), 'cert must be deleted even after profile delete failure');
});

test('deleteResources: profile is still deleted even when cert delete throws', async () => {
  const deleted: string[] = [];
  const mockDel = async (p: string) => {
    deleted.push(p);
    if (p.includes('/certificates/')) throw new Error('cert delete failed');
  };
  await assert.doesNotReject(() => deleteResources({ del: mockDel, certId: 'C1', profileId: 'P1' }));
  assert.ok(deleted.some((p: string) => p.includes('/profiles/P1')), 'profile delete must have been attempted');
});

test('deleteResources: null certId or profileId are skipped gracefully', async () => {
  const deleted: string[] = [];
  const mockDel = async (p: string) => { deleted.push(p); };
  await deleteResources({ del: mockDel, certId: null, profileId: null });
  assert.deepEqual(deleted, []);
  await deleteResources({ del: mockDel, certId: 'C1', profileId: null });
  assert.equal(deleted.length, 1);
  assert.ok((deleted[0] as string).includes('/certificates/C1'));
});

// ── Workflow security checks ───────────────────────────────────────────────────

test('workflow: signing.mjs runs in the key-holding step (Build on EAS), not any other step', () => {
  const signingSteps = wfSteps.filter((s: string) => s.includes('highersignal-signing.mjs'));
  assert.equal(signingSteps.length, 1, 'signing.mjs appears in exactly one step');
  assert.match(signingSteps[0], /Build on EAS/, 'signing.mjs must be in the EAS build step');
  assert.ok(
    signingSteps[0].includes('secrets.EXPO_TOKEN') || wfSteps[wfSteps.indexOf(signingSteps[0])].includes('EXPO_TOKEN'),
    'signing step must have access to secrets',
  );
});

test('workflow: testflight.mjs is not called directly from the workflow (signing.mjs owns that call)', () => {
  const stripped = wf.replace(/::.*$/gm, ''); // strip any inline comments that survived the filter
  assert.doesNotMatch(stripped, /node scripts\/highersignal-testflight\.mjs/);
});

test('signing script: calls highersignal-testflight.mjs, never prints secrets inline', () => {
  const src = readFileSync('scripts/highersignal-signing.mjs', 'utf8');
  assert.match(src, /highersignal-testflight\.mjs/);
  assert.match(src, /deleteResources/);
  assert.match(src, /try \{/);
  assert.match(src, /\} finally \{/);
  assert.match(src, /::add-mask::/);
  // the script must not log the p12 password outside of an ::add-mask:: call, or ever log the profile/p12 content
  assert.doesNotMatch(src, /console\.log\([^)]*p12Pass[^)]*\)[^;]*(\/\/.*)?$(?!.*add-mask)/m);
  assert.doesNotMatch(src, /console\.log\([^)]*profileContent/);
  assert.doesNotMatch(src, /console\.log\([^)]*p12Base64/);
  // the mask call for p12Pass is present (this IS the right way to handle it)
  assert.match(src, /add-mask.*p12Pass|p12Pass.*add-mask/);
});

test('signing script: uses RSA 2048 key (not ECDSA) for Apple Distribution cert', () => {
  const src = readFileSync('scripts/highersignal-signing.mjs', 'utf8');
  assert.match(src, /genrsa/);
  assert.doesNotMatch(src, /ecparam/);
});

test('signing script: -subj uses /O= attribute for team id (not bare /teamid)', () => {
  const src = readFileSync('scripts/highersignal-signing.mjs', 'utf8');
  assert.match(src, /\/O=\$\{APPLE_TEAM_ID\}/);
  assert.doesNotMatch(src, /\/CN=[^']*\/\$\{APPLE_TEAM_ID\}/);
});
