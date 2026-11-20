#!/usr/bin/env node
/**
 * Web build guard for the paywall (issue #126). Runs inside `npm run build:web`.
 *
 *   node scripts/check-web-build.mjs              before export: env checks
 *   node scripts/check-web-build.mjs --dist dist  after export: bundle scan
 *
 * Production (VERCEL_ENV=production, or EXPO_PUBLIC_DEPLOY_ENV=production):
 * - EXPO_PUBLIC_TEST_UNLOCK must be unset: the free test unlock never ships.
 * - EXPO_PUBLIC_RC_WEB_KEY must not be a sandbox (rcb_sb_) or Test Store (test_) key.
 * Preview / development: EXPO_PUBLIC_RC_WEB_KEY must not be a live key (rcb_ without sb_).
 * - The exported bundle must not contain the test-unlock marker text, which
 *   only exists inside code the minifier drops when the flag is off. If it is
 *   there, a free unlock path was compiled into production.
 * A production build without a web key only warns: the paywall then says
 * purchases are unavailable (no free unlock either).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TEST_UNLOCK_MARKER = 'TEST MODE: NO CHARGE';

/**
 * Same derivation as the build:web script: Vercel's VERCEL_ENV wins (a
 * misconfigured EXPO_PUBLIC_DEPLOY_ENV must not downgrade a production deploy),
 * else the explicit value, else development.
 */
export function deployEnvFrom(env) {
  return env.VERCEL_ENV || env.EXPO_PUBLIC_DEPLOY_ENV || 'development';
}

export function envProblems(env) {
  const problems = [];
  const warnings = [];
  const deployEnv = deployEnvFrom(env);
  const key = env.EXPO_PUBLIC_RC_WEB_KEY ?? '';
  if (env.VERCEL_ENV && env.EXPO_PUBLIC_DEPLOY_ENV && env.VERCEL_ENV !== env.EXPO_PUBLIC_DEPLOY_ENV) {
    problems.push(`EXPO_PUBLIC_DEPLOY_ENV="${env.EXPO_PUBLIC_DEPLOY_ENV}" conflicts with VERCEL_ENV="${env.VERCEL_ENV}". Remove EXPO_PUBLIC_DEPLOY_ENV from the Vercel project; the build derives it from VERCEL_ENV.`);
  }
  if (deployEnv === 'production') {
    if (env.EXPO_PUBLIC_TEST_UNLOCK) problems.push('EXPO_PUBLIC_TEST_UNLOCK is set on a production build. The free test unlock must never ship to production.');
    if (key.startsWith('rcb_sb_') || key.startsWith('test_')) problems.push('EXPO_PUBLIC_RC_WEB_KEY is a sandbox/test key on a production build. Use the live Web Billing key (rcb_...).');
    if (!key) warnings.push('EXPO_PUBLIC_RC_WEB_KEY is not set: the production paywall will say purchases are unavailable.');
  } else if (key.startsWith('rcb_') && !key.startsWith('rcb_sb_')) {
    problems.push(`EXPO_PUBLIC_RC_WEB_KEY is a live Web Billing key on a ${deployEnv} build. Previews and local builds must use the sandbox key (rcb_sb_...) so they can never take a real charge.`);
  }
  if (key && !key.startsWith('rcb_')) warnings.push('EXPO_PUBLIC_RC_WEB_KEY does not look like a Web Billing key (rcb_... or rcb_sb_...); web purchases stay off.');
  return { deployEnv, problems, warnings };
}

/** Files (path, text) that contain the marker. */
export function filesWithMarker(files) {
  return files.filter((f) => f.text.includes(TEST_UNLOCK_MARKER)).map((f) => f.path);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|html)$/.test(name)) out.push({ path: p, text: readFileSync(p, 'utf8') });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const distIdx = args.indexOf('--dist');
  const { deployEnv, problems, warnings } = envProblems(process.env);
  for (const w of warnings) console.warn(`warning: ${w}`);

  if (distIdx > -1) {
    const dir = args[distIdx + 1] ?? 'dist';
    const hits = filesWithMarker(walk(dir));
    if (deployEnv === 'production' && hits.length) {
      problems.push(`The production bundle contains the test-unlock UI ("${TEST_UNLOCK_MARKER}") in: ${hits.join(', ')}`);
    } else {
      console.log(`Test-unlock UI in bundle: ${hits.length ? 'yes' : 'no'} (deploy env "${deployEnv}").`);
    }
  }

  if (problems.length) {
    console.error(`Web build check failed (deploy env "${deployEnv}"):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Web build check passed (deploy env "${deployEnv}").`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
