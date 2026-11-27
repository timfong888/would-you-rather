/**
 * Verifies App Store screenshot dimensions and no-alpha constraint.
 *
 * Tests:
 *  1. checkPng helper: rejects wrong sizes, alpha channels, and non-PNGs.
 *  2. checkPng helper: accepts a correctly-sized flat RGB PNG header.
 *  3. Any committed PNG files in store/ios/screenshots/iphone-6.9/ pass both checks.
 *
 * PNG fixture buffers are constructed from raw IHDR bytes so the test has no
 * external build dependency; checkPng only reads the first 26 bytes.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// @ts-ignore: plain .mjs script
import { checkPng, CANVAS_W, CANVAS_H } from '../../scripts/store/compose.mjs';

/**
 * Builds the first 26 bytes of a PNG file (signature + IHDR header) with the
 * supplied dimensions and color type. checkPng() only reads these bytes.
 *
 * Color types: 2 = RGB (no alpha), 4 = Grayscale+Alpha, 6 = RGBA.
 */
function makePngHeader(w: number, h: number, colorType: number): Buffer {
  const buf = Buffer.alloc(26);
  // 8-byte PNG signature
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
  buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
  // IHDR chunk: 4-byte length = 13
  buf.writeUInt32BE(13, 8);
  // "IHDR" chunk type
  buf.write('IHDR', 12, 'ascii');
  // Width (4 bytes), height (4 bytes)
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  // Bit depth = 8
  buf[24] = 8;
  // Color type
  buf[25] = colorType;
  return buf;
}

describe('checkPng helper', () => {
  test('accepts a correctly-sized flat RGB (no-alpha) PNG', () => {
    const buf = makePngHeader(CANVAS_W, CANVAS_H, 2 /* RGB */);
    const errs = checkPng(buf);
    assert.deepEqual(errs, [], `expected no errors, got: ${errs.join('; ')}`);
  });

  test('rejects a PNG with wrong dimensions (6.3-inch 1206x2622)', () => {
    const buf = makePngHeader(1206, 2622, 2);
    const errs = checkPng(buf);
    assert.ok(errs.some((e: string) => e.includes('wrong size')), `expected size error, got: ${errs.join('; ')}`);
  });

  test('rejects an RGBA PNG (color type 6)', () => {
    const buf = makePngHeader(CANVAS_W, CANVAS_H, 6 /* RGBA */);
    const errs = checkPng(buf);
    assert.ok(errs.some((e: string) => e.includes('alpha')), `expected alpha error, got: ${errs.join('; ')}`);
  });

  test('rejects a Grayscale+Alpha PNG (color type 4)', () => {
    const buf = makePngHeader(CANVAS_W, CANVAS_H, 4 /* GA */);
    const errs = checkPng(buf);
    assert.ok(errs.some((e: string) => e.includes('alpha')), `expected alpha error, got: ${errs.join('; ')}`);
  });

  test('rejects a non-PNG buffer', () => {
    const buf = Buffer.from('this is not a png file');
    const errs = checkPng(buf);
    assert.ok(errs.some((e: string) => e.includes('not a PNG')), `expected PNG error, got: ${errs.join('; ')}`);
  });
});

describe('committed screenshots in store/ios/screenshots/iphone-6.9/', () => {
  const screenshotsDir = path.resolve('store/ios/screenshots/iphone-6.9');

  if (!existsSync(screenshotsDir)) {
    test('directory not yet created — no PNGs to check', () => {
      // The directory is created by the CI workflow; nothing committed yet. Pass.
    });
    // eslint-disable-next-line no-useless-return
    return;
  }

  const pngFiles = readdirSync(screenshotsDir).filter(
    (f) => f.endsWith('.png') && !f.startsWith('.'),
  );

  if (pngFiles.length === 0) {
    test('no PNG files committed yet', () => {
      // PNGs live as workflow artifacts until Tim approves and commits them. Pass.
    });
    return;
  }

  for (const file of pngFiles) {
    test(`${file} is ${CANVAS_W}×${CANVAS_H} with no alpha`, () => {
      const buf = readFileSync(path.join(screenshotsDir, file));
      const errs = checkPng(buf);
      assert.deepEqual(errs, [], `${file}: ${errs.join('; ')}`);
    });
  }
});
