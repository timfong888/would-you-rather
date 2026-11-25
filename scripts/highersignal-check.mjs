#!/usr/bin/env node
// Secretless self-contained check for the Higher Signal build directory. Used by .github/workflows/highersignal-ios-testflight.yml
// before dependencies are installed and before any Apple/Expo secret step. Env: HIGHERSIGNAL_ROOT, HIGHERSIGNAL_SUBDIR, HIGHERSIGNAL_APP_ID, EAS_PROFILE.
// Prints fixed text and line numbers only (never repo file content). Exits 1 on errors.
import * as fs from 'node:fs';
import { resolveDir, checkSelfContained, validateAppId } from './lib/highersignalRelease.mjs';

const { HIGHERSIGNAL_ROOT, HIGHERSIGNAL_SUBDIR, HIGHERSIGNAL_APP_ID, EAS_PROFILE } = process.env;
let dir;
try { validateAppId(HIGHERSIGNAL_APP_ID); dir = resolveDir(HIGHERSIGNAL_ROOT, HIGHERSIGNAL_SUBDIR); } catch (e) { console.error(e.message); process.exit(2); }
const r = checkSelfContained(dir, HIGHERSIGNAL_SUBDIR, { fs, root: HIGHERSIGNAL_ROOT, profile: EAS_PROFILE || 'production' });
for (const l of r.lines) console.log(l);
for (const w of r.warnings) console.log(`::warning::${w}`);
for (const e of r.errors) console.log(`::error::${e}`);
process.exit(r.errors.length ? 1 : 0);
