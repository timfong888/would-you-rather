#!/usr/bin/env node
/**
 * Web build guard for the paywall (issue #126). Runs inside `npm run build:web`.
 *
 *   node scripts/check-web-build.mjs              before export: env checks
 *   node scripts/check-web-build.mjs --dist dist  after export: bundle scan
 *
 * Production (VERCEL_ENV=production, or EXPO_PUBLIC_DEPLOY_ENV=production):
 * - EXPO_PUBLIC_RC_WEB_KEY must not be a sandbox (rcb_sb_) or Test Store (test_) key.
 * Preview / development: EXPO_PUBLIC_RC_WEB_KEY must not be a live key (rcb_ without sb_). Use the
 *   RevenueCat Test Store key (test_), which never charges (Tim, 2026-11-21, "Test Store yes").
 * Any build: EXPO_PUBLIC_TEST_UNLOCK must be unset. The old preview free unlock was removed in
 *   favour of the Test Store; the marker scan below still guards production against its UI.
 * - The exported bundle must not contain the test-unlock marker text, which
 *   only exists inside code the minifier drops when the flag is off. If it is
 *   there, a free unlock path was compiled into production.
 * A production build without a web key only warns: the paywall then says
 * purchases are unavailable (no free unlock either).
 *
 * Temporary production web free unlock (Tim, 2026-11-21, "128 b"):
 * EXPO_PUBLIC_WEB_FREE_UNLOCK=1 is allowed on production until web payments
 * exist. It may not be combined with a live web key (the free unlock would
 * hide real purchases). When it is unset on production, the bundle must not
 * contain its marker text, so turning it off really removes it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TEST_UNLOCK_MARKER = 'TEST MODE: NO CHARGE';
export const WEB_FREE_UNLOCK_MARKER = 'FREE FOR NOW';

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
  if (env.EXPO_PUBLIC_TEST_UNLOCK) problems.push(`EXPO_PUBLIC_TEST_UNLOCK is set on a ${deployEnv} build. The free test unlock was removed: delete the variable and use the RevenueCat Test Store key (test_...) as EXPO_PUBLIC_RC_WEB_KEY on previews.`);
  if (deployEnv === 'production') {
    if (key.startsWith('rcb_sb_') || key.startsWith('test_')) problems.push('EXPO_PUBLIC_RC_WEB_KEY is a sandbox/test key on a production build. Use the live Web Billing key (rcb_...).');
    if (env.EXPO_PUBLIC_WEB_FREE_UNLOCK && env.EXPO_PUBLIC_WEB_FREE_UNLOCK !== '1') problems.push(`EXPO_PUBLIC_WEB_FREE_UNLOCK must be exactly "1" or unset (got "${env.EXPO_PUBLIC_WEB_FREE_UNLOCK}").`);
    if (env.EXPO_PUBLIC_WEB_FREE_UNLOCK === '1') {
      if (key.startsWith('rcb_') && !key.startsWith('rcb_sb_')) problems.push('EXPO_PUBLIC_WEB_FREE_UNLOCK is set together with the live web key. Web payments are live: delete EXPO_PUBLIC_WEB_FREE_UNLOCK from Vercel Production.');
      warnings.push('EXPO_PUBLIC_WEB_FREE_UNLOCK=1: the production web paywall unlocks for free (temporary, until web payments exist).');
    } else if (!key) warnings.push('EXPO_PUBLIC_RC_WEB_KEY is not set: the production paywall will say purchases are unavailable.');
  } else if (key.startsWith('rcb_') && !key.startsWith('rcb_sb_')) {
    problems.push(`EXPO_PUBLIC_RC_WEB_KEY is a live Web Billing key on a ${deployEnv} build. Previews and local builds must use the Test Store key (test_...) or the sandbox key (rcb_sb_...) so they can never take a real charge.`);
  }
  if (key && !key.startsWith('rcb_') && !key.startsWith('test_')) warnings.push('EXPO_PUBLIC_RC_WEB_KEY does not look like a RevenueCat web key (test_..., rcb_sb_... or rcb_...); web purchases stay off.');
  if (key.startsWith('test_') && deployEnv !== 'production') warnings.push(`EXPO_PUBLIC_RC_WEB_KEY is the RevenueCat Test Store key: purchases on this ${deployEnv} build are simulated and never charge.`);
  return { deployEnv, problems, warnings };
}

/** Files (path, text) that contain the marker (the test-unlock marker by default). */
export function filesWithMarker(files, marker = TEST_UNLOCK_MARKER) {
  return files.filter((f) => f.text.includes(marker)).map((f) => f.path);
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
    const files = walk(dir);
    const hits = filesWithMarker(files);
    if (deployEnv === 'production' && hits.length) {
      problems.push(`The production bundle contains the test-unlock UI ("${TEST_UNLOCK_MARKER}") in: ${hits.join(', ')}`);
    } else {
      console.log(`Test-unlock UI in bundle: ${hits.length ? 'yes' : 'no'} (deploy env "${deployEnv}").`);
    }
    const freeHits = filesWithMarker(files, WEB_FREE_UNLOCK_MARKER);
    if (deployEnv === 'production' && freeHits.length && process.env.EXPO_PUBLIC_WEB_FREE_UNLOCK !== '1') {
      problems.push(`The production bundle contains the web free-unlock UI ("${WEB_FREE_UNLOCK_MARKER}") but EXPO_PUBLIC_WEB_FREE_UNLOCK is off, in: ${freeHits.join(', ')}`);
    } else {
      console.log(`Web free-unlock UI in bundle: ${freeHits.length ? 'yes' : 'no'} (deploy env "${deployEnv}").`);
    }
  }

  if (problems.length) {
    console.error(`Web build check failed (deploy env "${deployEnv}"):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Web build check passed (deploy env "${deployEnv}").`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
