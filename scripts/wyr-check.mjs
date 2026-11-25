#!/usr/bin/env node
// Secretless self-containment check of the cloned wyr_sha. Used by .github/workflows/wyr-ios-testflight.yml BEFORE npm ci and
// before the secret step. Env: WYR_ROOT (absolute path of the clone), EAS_PROFILE. Prints fixed text and line numbers only.
import * as fs from 'node:fs';
import { checkWyrSelfContained, WYR_PROFILE } from './lib/wyrRelease.mjs';

const { WYR_ROOT, EAS_PROFILE } = process.env;
if (!WYR_ROOT || !WYR_ROOT.startsWith('/')) { console.error('WYR_ROOT must be an absolute path.'); process.exit(2); }
const profile = EAS_PROFILE || WYR_PROFILE;
if (profile !== WYR_PROFILE) { console.error(`EAS_PROFILE must be ${WYR_PROFILE}.`); process.exit(2); }
const r = checkWyrSelfContained(WYR_ROOT, { fs, profile });
for (const l of r.lines) console.log(l);
for (const w of r.warnings) console.log(`::warning::${w}`);
for (const e of r.errors) console.log(`::error::${e}`);
process.exit(r.errors.length ? 1 : 0);
