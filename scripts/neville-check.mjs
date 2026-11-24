#!/usr/bin/env node
// Secretless self-contained check for the chosen neville directory. Used by .github/workflows/neville-ios-testflight.yml
// before dependencies are installed and before any secret step. Env: NEVILLE_ROOT, NEVILLE_SUBDIR (ios-shell | native), EAS_PROFILE.
// Prints fixed text and line numbers only (never neville file content). Exits 1 on errors, warns on soft findings.
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveNevilleDir, checkSelfContained } from './lib/nevilleRelease.mjs';

const { NEVILLE_ROOT, NEVILLE_SUBDIR, EAS_PROFILE, RUNNER_TEMP } = process.env;
let dir;
try { dir = resolveNevilleDir(NEVILLE_ROOT, NEVILLE_SUBDIR); } catch (e) { console.error(e.message); process.exit(2); }
const g = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' });
const gitRoot = g.status === 0 ? g.stdout.trim().replace(RUNNER_TEMP || '\0', '$RUNNER_TEMP') : '';
const r = checkSelfContained(dir, NEVILLE_SUBDIR, { fs, profile: EAS_PROFILE || 'production', gitRoot });
for (const l of r.lines) console.log(l);
for (const w of r.warnings) console.log(`::warning::${w}`);
for (const e of r.errors) console.log(`::error::${e}`);
process.exit(r.errors.length ? 1 : 0);
