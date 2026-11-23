#!/usr/bin/env node
// Read-only: list every app in the App Store Connect account with its latest TestFlight build.
// Used by .github/workflows/apple-apps-list.yml. GET requests to api.appstoreconnect.apple.com only.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (.p8 contents), optional MATCH (regexp, default ".").
// Never prints the key, the JWT or the ids: all output goes through a redactor.
// Usage: node scripts/asc-apps-list.mjs [--out <dir>]
import { createPrivateKey, sign } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildRows, makeRedactor, toMarkdown } from './lib/ascAppsList.mjs';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY, MATCH, GITHUB_STEP_SUMMARY } = process.env;
const redact = makeRedactor([ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY]);
const say = (m) => console.log(redact(m));
const die = (m, code = 1) => { console.error(redact(m)); process.exit(code); };

for (const [k, v] of Object.entries({ ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY })) {
  if (!v) die(`Missing ${k} (set it as a GitHub Actions secret).`, 2);
}
const args = process.argv.slice(2);
const outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'asc-apps-list';

const b64u = (b) => Buffer.from(b).toString('base64url');
function jwt() {
  const header = { alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(payload))}`;
  const key = createPrivateKey(ASC_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64u(sig)}`;
}

// GET only. There is deliberately no method parameter.
async function get(path) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt()}` } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { nonJson: true }; }
  return { status: res.status, body };
}

try {
  const rows = await buildRows(get, { match: MATCH });
  const md = toMarkdown(rows, { match: MATCH || '.' });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/apps.md`, redact(md));
  writeFileSync(`${outDir}/apps.json`, redact(JSON.stringify(rows, null, 2)));
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, redact(md));
  say(md);
  const nev = rows.filter((r) => r.neville);
  say(nev.length ? `Neville matches: ${nev.map((r) => `${r.name} (${r.appleAppId})`).join(', ')}` : 'No app name or bundle ID contains "neville".');
} catch (e) {
  die(`apps list failed: ${e.message}`);
}
