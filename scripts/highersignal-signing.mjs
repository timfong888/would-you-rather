#!/usr/bin/env node
// scripts/highersignal-signing.mjs
// Creates a short-lived Apple Distribution certificate and IOS_APP_STORE provisioning profile via
// the App Store Connect API, writes EAS local credentials to the temp clone, runs
// scripts/highersignal-testflight.mjs, then deletes the cert and profile on exit.
//
// Called from: .github/workflows/highersignal-ios-testflight.yml  (key-holding step, replaces the
// direct testflight.mjs call).  All ASC secrets are already masked by the step shell code before
// this script runs.
//
// Steps:
//   1. GET /v1/certificates – stop if 3+ DISTRIBUTION certs exist (never revoke or delete)
//   2. openssl key + CSR (0600 temp dir outside the checkout)
//      POST /v1/certificates  →  IOS_DISTRIBUTION cert
//   3. GET /v1/bundleIds?filter[identifier]=sophia.pkg
//      POST /v1/profiles  →  IOS_APP_STORE profile
//   4. openssl pkcs12 → .p12 with a random password (password masked immediately)
//      Decode provisioning profile → profile.mobileprovision in temp dir
//      Write credentials.json (path-based, credentialsSource: local schema) to appDir (temp clone only)
//      Patch eas.json in appDir with credentialsSource: "local" (original restored on exit)
//   5. node scripts/highersignal-testflight.mjs (subprocess, stdio: inherit)
//   6. EXIT trap (try/finally): DELETE profile, DELETE cert, rm tempDir, restore eas.json

import { createPrivateKey, sign, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pure helpers (all exported; tested without I/O) ────────────────────────────

/** Returns the count of DISTRIBUTION certs. Throws (without touching Apple) if 3 or more. */
export function checkCertLimit(certs) {
  const dist = (certs ?? []).filter(
    (c) => c?.attributes?.certificateType === 'IOS_DISTRIBUTION' ||
           c?.attributes?.certificateType === 'DISTRIBUTION',
  );
  if (dist.length >= 3) {
    const ids = dist.slice(0, 5).map((c) => c.id).join(', ');
    throw new Error(
      `${dist.length} IOS_DISTRIBUTION/DISTRIBUTION certificates already exist (limit: 3 before ` +
      `manual cleanup is required). Revoke one in App Store Connect, then retry. ` +
      `Existing cert IDs: ${ids}`,
    );
  }
  return dist.length;
}

/** POST /v1/certificates request body. */
export function buildCertificateBody(csrContent) {
  return {
    data: {
      type: 'certificates',
      attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent },
    },
  };
}

/** POST /v1/profiles request body. */
export function buildProfileBody(bundleIdId, certId, name) {
  return {
    data: {
      type: 'profiles',
      attributes: { name, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { id: bundleIdId, type: 'bundleIds' } },
        certificates: { data: [{ id: certId, type: 'certificates' }] },
        devices: { data: [] },
      },
    },
  };
}

/** credentials.json structure for EAS local credentials (path-based, credentialsSource: local). */
export function buildCredentialsJson(p12Path, certPassword, profilePath) {
  return {
    ios: {
      distributionCertificate: { path: p12Path, password: certPassword },
      provisioningProfilePath: profilePath,
    },
  };
}

/** Returns a patched copy of eas.json with credentialsSource: "local" on the named profile. */
export function patchEasJson(easJson, profile) {
  const out = JSON.parse(JSON.stringify(easJson));
  if (!out.build) out.build = {};
  if (!out.build[profile]) out.build[profile] = {};
  out.build[profile].credentialsSource = 'local';
  return out;
}

/**
 * Extract { id, certificateContent } from a POST /v1/certificates response.
 * On 403, the error message includes "needs Admin role" and the exact Apple error code.
 */
export function parseCertResult(body, status) {
  if (status !== 201) {
    const err = body?.errors?.[0];
    const code = err?.code ?? String(status);
    const detail = err?.detail ?? err?.title ?? '(no detail)';
    const adminSuffix = (status === 403 || String(err?.status) === '403') ? ' (needs Admin role)' : '';
    throw new Error(`POST /v1/certificates failed HTTP ${status}: ${code} — ${detail}${adminSuffix}`);
  }
  const data = body?.data;
  if (!data?.id) throw new Error('POST /v1/certificates: response missing data.id');
  const certContent = data.attributes?.certificateContent;
  if (!certContent) throw new Error('POST /v1/certificates: response missing certificateContent');
  return { id: String(data.id), certificateContent: String(certContent) };
}

/** Extract { id, profileContent } from a POST /v1/profiles response. */
export function parseProfileResult(body, status) {
  if (status !== 201) {
    const err = body?.errors?.[0];
    const code = err?.code ?? String(status);
    const detail = err?.detail ?? err?.title ?? '(no detail)';
    throw new Error(`POST /v1/profiles failed HTTP ${status}: ${code} — ${detail}`);
  }
  const data = body?.data;
  if (!data?.id) throw new Error('POST /v1/profiles: response missing data.id');
  const profileContent = data.attributes?.profileContent;
  if (!profileContent) throw new Error('POST /v1/profiles: response missing profileContent');
  return { id: String(data.id), profileContent: String(profileContent) };
}

/** Find the bundle ID resource ID in a GET /v1/bundleIds response. */
export function parseBundleIdResult(body, status, bundleIdentifier) {
  if (status !== 200) throw new Error(`GET /v1/bundleIds failed HTTP ${status}`);
  const rows = Array.isArray(body?.data) ? body.data : (body?.data ? [body.data] : []);
  const match = rows.find((r) => r?.attributes?.identifier === bundleIdentifier);
  if (!match) {
    throw new Error(
      `Bundle ID resource for "${bundleIdentifier}" not found in App Store Connect. ` +
      `Register the bundle ID at developer.apple.com/account/resources/identifiers/list first.`,
    );
  }
  return String(match.id);
}

/**
 * Delete a cert and/or profile from ASC. Exported so tests can inject a mock `del` function.
 * Errors are logged but never abort the remaining deletion.
 * Profile is deleted before the cert (profile references the cert; reversing the order
 * leaves a dangling profile that Apple won't auto-clean).
 */
export async function deleteResources({ del, certId, profileId, say = console.log }) {
  if (profileId) {
    say(`cleanup: deleting profile ${profileId}`);
    try { await del(`/v1/profiles/${profileId}`); } catch (e) { console.error(`cleanup: profile delete failed: ${e.message}`); }
  }
  if (certId) {
    say(`cleanup: deleting certificate ${certId}`);
    try { await del(`/v1/certificates/${certId}`); } catch (e) { console.error(`cleanup: cert delete failed: ${e.message}`); }
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runSigning()
    .then((code) => { process.exitCode = code; })
    .catch((e) => { console.error(e.message); process.exitCode = 1; });
}

async function runSigning() {
  const env = process.env;
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID, HIGHERSIGNAL_ROOT, HIGHERSIGNAL_SUBDIR } = env;

  for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, APPLE_TEAM_ID, HIGHERSIGNAL_ROOT })) {
    if (!v) { console.error(`Missing required env var: ${k}`); return 1; }
  }

  const profile = env.EAS_PROFILE || 'production';
  const appDir = join(HIGHERSIGNAL_ROOT, HIGHERSIGNAL_SUBDIR || 'app');
  const bundleId = 'sophia.pkg';

  // The shell already emitted ::add-mask:: for each line of ASC_PRIVATE_KEY before this script ran;
  // mask again here so the Node layer (console.log) also redacts these values.
  const rawKey = ASC_PRIVATE_KEY.replace(/\\n/g, '\n');
  for (const line of [ASC_KEY_ID, ASC_ISSUER_ID, APPLE_TEAM_ID, ...rawKey.split(/\r?\n/)]) {
    if (line && line.trim().length >= 4) console.log(`::add-mask::${line.trim()}`);
  }

  const say = (m) => console.log(m);

  // JWT builder – same pattern as highersignal-testflight.mjs.
  const b64u = (b) => Buffer.from(b).toString('base64url');
  function jwt() {
    const now = Math.floor(Date.now() / 1000);
    const header = JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' });
    const payload = JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' });
    const input = `${b64u(header)}.${b64u(payload)}`;
    const key = createPrivateKey(rawKey);
    const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
    return `${input}.${b64u(sig)}`;
  }

  async function get(path) {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      headers: { Authorization: `Bearer ${jwt()}` },
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = {}; }
    return { status: res.status, body };
  }

  async function post(path, bodyObj) {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = {}; }
    return { status: res.status, body };
  }

  async function del(path) {
    const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt()}` },
      signal: AbortSignal.timeout(30000),
    });
    if (res.status !== 204) {
      const text = await res.text().catch(() => '');
      throw new Error(`DELETE ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  // Resources to clean up regardless of outcome.
  let createdCertId = null;
  let createdProfileId = null;
  let tempDir = null;
  let origEasJson = null;
  let credWritten = false;

  try {
    // ── Step 1: list certificates ──────────────────────────────────────────────
    say('signing: listing existing distribution certificates');
    const { status: ls, body: lb } = await get(
      '/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION,DISTRIBUTION&limit=50',
    );
    if (ls !== 200) throw new Error(`GET /v1/certificates failed HTTP ${ls}`);
    const existing = Array.isArray(lb?.data) ? lb.data : [];
    const existCount = checkCertLimit(existing);
    say(`signing: ${existCount} existing distribution certificate(s), proceeding`);

    // ── Step 2: key + CSR (0600 temp dir outside the checkout) ────────────────
    say('signing: creating temp dir for key material');
    tempDir = mkdtempSync(join(tmpdir(), 'asc-signing-'));
    fs.chmodSync(tempDir, 0o700);

    const keyPath     = join(tempDir, 'key.pem');
    const csrPath     = join(tempDir, 'csr.pem');
    const certPath    = join(tempDir, 'cert.cer');
    const certPemPath = join(tempDir, 'cert.pem');
    const p12Path     = join(tempDir, 'dist.p12');

    // No shell: each openssl call is an explicit execv, never interpolated.
    const ossl = (...args) => spawnSync('openssl', args, { encoding: 'utf8' });

    let r = ossl('genrsa', '-out', keyPath, '2048');
    if (r.status !== 0) throw new Error(`openssl genrsa failed: ${r.stderr}`);
    fs.chmodSync(keyPath, 0o600);

    r = ossl('req', '-new', '-sha256', '-key', keyPath, '-out', csrPath,
      '-subj', `/CN=Higher Signal Distribution/O=${APPLE_TEAM_ID}`);
    if (r.status !== 0) throw new Error(`openssl req failed: ${r.stderr}`);

    const csrPem = readFileSync(csrPath, 'utf8');
    say('signing: CSR generated, posting to App Store Connect');

    const certReq = buildCertificateBody(csrPem);
    const { status: cs, body: cb } = await post('/v1/certificates', certReq);
    const { id: certId, certificateContent } = parseCertResult(cb, cs);
    createdCertId = certId;
    say(`signing: certificate created (id: ${certId})`);

    // Convert base64 DER cert → PEM so openssl pkcs12 can read it.
    writeFileSync(certPath, Buffer.from(certificateContent, 'base64'));
    r = ossl('x509', '-inform', 'DER', '-in', certPath, '-out', certPemPath);
    if (r.status !== 0) throw new Error(`openssl x509 DER→PEM failed: ${r.stderr}`);

    // ── Step 3: bundle ID resource + IOS_APP_STORE profile ────────────────────
    say(`signing: looking up bundle ID resource for ${bundleId}`);
    const { status: bs, body: bb } = await get(
      `/v1/bundleIds?filter[identifier]=${bundleId}&limit=5`,
    );
    const bundleIdId = parseBundleIdResult(bb, bs, bundleId);
    say(`signing: bundleId resource id: ${bundleIdId}`);

    const profileName = `Higher Signal CI ${Date.now()}`;
    const profReq = buildProfileBody(bundleIdId, certId, profileName);
    const { status: ps, body: pb } = await post('/v1/profiles', profReq);
    const { id: profileId, profileContent } = parseProfileResult(pb, ps);
    createdProfileId = profileId;
    say(`signing: profile created (id: ${profileId})`);

    // ── Step 4: .p12 + credentials.json + patched eas.json ────────────────────
    const p12Pass = randomBytes(24).toString('base64').replace(/[+/=]/g, '').slice(0, 32);
    // Mask immediately so it never appears in subsequent log lines.
    console.log(`::add-mask::${p12Pass}`);

    // -legacy: older PKCS12 encryption used by some iOS tooling; fall back to default if unavailable.
    r = ossl('pkcs12', '-export', '-out', p12Path,
      '-inkey', keyPath, '-in', certPemPath, '-passout', `pass:${p12Pass}`, '-legacy');
    if (r.status !== 0) {
      r = ossl('pkcs12', '-export', '-out', p12Path,
        '-inkey', keyPath, '-in', certPemPath, '-passout', `pass:${p12Pass}`);
      if (r.status !== 0) throw new Error(`openssl pkcs12 failed: ${r.stderr}`);
    }
    say('signing: .p12 built');

    // Decode the provisioning profile to a file — EAS local credentials require a file path, not inline base64.
    const profileFilePath = join(tempDir, 'profile.mobileprovision');
    writeFileSync(profileFilePath, Buffer.from(profileContent, 'base64'), { mode: 0o600 });
    say('signing: provisioning profile written to temp dir');

    // Write credentials.json with path-based references (credentialsSource: local schema).
    const creds = buildCredentialsJson(p12Path, p12Pass, profileFilePath);
    writeFileSync(join(appDir, 'credentials.json'), JSON.stringify(creds, null, 2), { mode: 0o600 });
    credWritten = true;
    say('signing: credentials.json written to app dir (temp clone)');

    // Patch eas.json with credentialsSource: local so EAS uses the credentials above.
    // Save the original content; cleanup restores it even on failure.
    origEasJson = readFileSync(join(appDir, 'eas.json'), 'utf8');
    const patched = patchEasJson(JSON.parse(origEasJson), profile);
    writeFileSync(join(appDir, 'eas.json'), JSON.stringify(patched, null, 2), 'utf8');
    say(`signing: eas.json patched (credentialsSource: local for profile "${profile}")`);

    // ── Step 5: run the existing EAS build and upload ──────────────────────────
    say('signing: running highersignal-testflight.mjs');
    const scriptDir = new URL('.', import.meta.url).pathname;
    const child = spawnSync('node', [join(scriptDir, 'highersignal-testflight.mjs')], {
      stdio: 'inherit',
      env: process.env,
    });
    if (child.status !== 0) return child.status ?? 1;
    return 0;

  } finally {
    // ── Step 6: cleanup (runs even on failure) ─────────────────────────────────
    await deleteResources({ del, certId: createdCertId, profileId: createdProfileId, say });
    if (credWritten) {
      try { rmSync(join(appDir, 'credentials.json'), { force: true }); } catch { /* ignore */ }
    }
    if (origEasJson !== null) {
      try { writeFileSync(join(appDir, 'eas.json'), origEasJson, 'utf8'); } catch { /* ignore */ }
    }
    if (tempDir) {
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
