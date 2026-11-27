#!/usr/bin/env node
/**
 * Composes App Store screenshots for the iPhone 6.3" slot (1206x2622).
 *
 * For each shot in store/ios/storyboard.json:
 *   1. Read the raw simulator screenshot from --raw-dir (default: store/ios/screenshots/iphone-6.3/raw/)
 *   2. Scale it to fit the screen area, apply rounded corners
 *   3. Place on a gradient background (indigo #5C54E8 → pink #E8316A)
 *   4. Composite caption text in bold white type
 *   5. Write a flattened (no-alpha) PNG to store/ios/screenshots/iphone-6.3/NN-name.png
 *
 * Usage: node scripts/store/compose.mjs [--raw-dir <dir>] [--out-dir <dir>] [--dry-run]
 *
 * Requires: sharp (already in package.json dependencies)
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const storyboard = JSON.parse(readFileSync(path.join(ROOT, 'store/ios/storyboard.json'), 'utf8'));

// --- Canvas dimensions (App Store 6.3" iPhone, §8.3) ---
export const CANVAS_W = storyboard.size.width;   // 1206
export const CANVAS_H = storyboard.size.height;  // 2622

// --- Screen area: app screenshot placed in the upper 68% ---
// Scale raw screenshot (1206×2622 aspect) to fit: width = 800px, height preserves ratio
const SCREEN_W = 800;
const SCREEN_H = Math.round(SCREEN_W * CANVAS_H / CANVAS_W);  // 800 * 2622/1206 = 1738
const SCREEN_X = Math.floor((CANVAS_W - SCREEN_W) / 2);       // 203 — centred
const SCREEN_Y = 90;
const CORNER_R = 50;  // rounded-corner radius on the displayed screen

// --- Caption zone: remaining space below the screen ---
const CAPTION_TOP = SCREEN_Y + SCREEN_H + 60;        // 90 + 1738 + 60 = 1888
const CAPTION_MID_Y = CAPTION_TOP + (CANVAS_H - CAPTION_TOP) / 2; // 1888 + 367 = 2255
const FONT_SIZE = 86;
const LINE_H = Math.round(FONT_SIZE * 1.22);  // 105 — line-height

// --- Palette ---
const INDIGO = '#5C54E8';
const PINK = '#E8316A';

// ─── Pure helpers (exported for tests) ─────────────────────────────────────

/**
 * Checks a PNG buffer for exact canvas dimensions and no alpha channel.
 * Returns an array of error strings; empty = OK.
 */
export function checkPng(buf) {
  const errors = [];
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 26 || sig.some((b, i) => buf[i] !== b)) {
    errors.push('not a PNG');
    return errors;
  }
  if (buf.toString('ascii', 12, 16) !== 'IHDR') {
    errors.push('missing IHDR chunk');
    return errors;
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  // PNG color type byte is at offset 25 of the file (after 8-byte sig + 4-byte length + 4-byte "IHDR" + 4-byte width + 4-byte height + 1-byte bitdepth)
  const colorType = buf[25];
  if (w !== CANVAS_W || h !== CANVAS_H) {
    errors.push(`wrong size: ${w}×${h}, want ${CANVAS_W}×${CANVAS_H}`);
  }
  // Color types 4 (gray+alpha) and 6 (RGBA) have an alpha channel
  if (colorType === 4 || colorType === 6) {
    errors.push(`has alpha channel (color type ${colorType})`);
  }
  return errors;
}

// ─── Rendering helpers ──────────────────────────────────────────────────────

function escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function makeBackground() {
  const svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${INDIGO}"/>
        <stop offset="100%" stop-color="${PINK}"/>
      </linearGradient>
    </defs>
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#g)"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function applyRoundedCorners(inputBuf, w, h) {
  // Create a rounded-rect mask (white = keep)
  const maskSvg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" rx="${CORNER_R}" ry="${CORNER_R}" fill="white"/>
  </svg>`;
  const maskBuf = await sharp(Buffer.from(maskSvg)).png().toBuffer();
  return sharp(inputBuf)
    .resize(w, h, { fit: 'fill' })
    .ensureAlpha()
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function makeCaptionOverlay(lines) {
  const n = lines.length;
  // Centre the block of lines on CAPTION_MID_Y
  const blockH = (n - 1) * LINE_H;
  const textElements = lines.map((line, i) => {
    const y = CAPTION_MID_Y - blockH / 2 + i * LINE_H;
    return `<text
        x="${CANVAS_W / 2}"
        y="${y}"
        font-family="'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="${FONT_SIZE}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
        dominant-baseline="central"
      >${escXml(line)}</text>`;
  }).join('\n');

  const svg = `<svg width="${CANVAS_W}" height="${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
    ${textElements}
  </svg>`;
  return Buffer.from(svg);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function composeShot(shot, rawDir, outDir) {
  const rawPath = path.join(rawDir, `${shot.id}.png`);
  if (!existsSync(rawPath)) {
    console.warn(`  skip ${shot.id} — raw file not found: ${rawPath}`);
    return false;
  }

  const outPath = path.join(outDir, `${shot.id}.png`);
  console.log(`  ${shot.id}: compositing…`);

  const rawBuf = readFileSync(rawPath);

  // 1. Gradient background
  const bgBuf = await makeBackground();

  // 2. Scale + round the raw screenshot
  const screenBuf = await applyRoundedCorners(rawBuf, SCREEN_W, SCREEN_H);

  // 3. Caption SVG overlay
  const captionSvg = await makeCaptionOverlay(shot.lines);

  // 4. Composite everything: background → screen → caption
  const result = await sharp(bgBuf)
    .composite([
      { input: screenBuf, left: SCREEN_X, top: SCREEN_Y },
      { input: captionSvg, left: 0, top: 0 },
    ])
    .flatten()   // strip any residual alpha → RGB PNG
    .png({ compressionLevel: 9 })
    .toBuffer();

  // 5. Verify before writing
  const errs = checkPng(result);
  if (errs.length) throw new Error(`${shot.id}: output failed checks: ${errs.join('; ')}`);

  sharp(result).toFile(outPath);
  console.log(`  ✓ ${outPath}`);
  return true;
}

async function run() {
  const args = process.argv.slice(2);
  const rawDir = args[args.indexOf('--raw-dir') + 1] ??
    path.join(ROOT, 'store/ios/screenshots/iphone-6.3/raw');
  const outDir = args[args.indexOf('--out-dir') + 1] ??
    path.join(ROOT, 'store/ios/screenshots/iphone-6.3');
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('dry-run: showing storyboard plan');
    for (const shot of storyboard.shots) {
      console.log(`  ${shot.id}: ${shot.lines.join(' / ')}`);
    }
    return;
  }

  mkdirSync(outDir, { recursive: true });

  let composed = 0;
  let skipped = 0;
  for (const shot of storyboard.shots) {
    const ok = await composeShot(shot, rawDir, outDir);
    if (ok) composed++; else skipped++;
  }

  console.log(`\ncompose done: ${composed} composed, ${skipped} skipped (no raw file)`);
  if (composed === 0 && skipped > 0) {
    console.log('No raw screenshots found. Run the ios-simulator-screenshots workflow first.');
  }
}

// Only run when this file is the entry point (not when imported by tests)
const thisFile = new URL(import.meta.url).pathname;
const entryFile = process.argv[1] ? new URL(process.argv[1], 'file:').pathname : '';
if (thisFile === entryFile) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
