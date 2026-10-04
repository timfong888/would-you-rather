#!/usr/bin/env node
/**
 * Print the SHA-256 digest of an owner access code, for
 * EXPO_PUBLIC_OWNER_ACCESS_SHA256.
 *
 *   node scripts/owner-code-hash.mjs "my long random passphrase"
 *   node scripts/owner-code-hash.mjs            # generates a random code for you
 *
 * The code itself is never committed or deployed — only the digest is.
 */
import { createHash, randomBytes } from 'node:crypto';

const provided = process.argv.slice(2).join(' ').trim();
const code = provided || randomBytes(24).toString('base64url');
const digest = createHash('sha256').update(code).digest('hex');

if (!provided) {
  console.log('Generated owner access code (store it in your password manager):');
  console.log(`  ${code}\n`);
}
console.log('Set this in Vercel (and your local .env) as EXPO_PUBLIC_OWNER_ACCESS_SHA256:');
console.log(`  ${digest}`);
