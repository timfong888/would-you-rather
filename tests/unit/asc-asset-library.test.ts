import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// EC key for subprocess JWT signing (same approach as asc-api-readonly.test.ts).
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

// Inline pure functions matching scripts/lib/ascAssetLibrary.mjs for unit tests.
// Intentionally duplicated here so tests do not depend on runtime import semantics.
function buildReserveBody({ libraryId, fileName, fileSize, category, referenceName }: {
  libraryId: string; fileName: string; fileSize: number; category: string; referenceName: string;
}) {
  return {
    data: {
      type: 'appAssetLibraryImages',
      attributes: {
        fileName,
        fileSize,
        category,
        ...(referenceName ? { referenceName } : {}),
      },
      relationships: {
        assetLibrary: { data: { type: 'appAssetLibraries', id: libraryId } },
      },
    },
  };
}

function buildCommitBody({ imageId }: { imageId: string }) {
  return { data: { type: 'appAssetLibraryImages', id: imageId, attributes: { uploaded: true } } };
}

function assertCannotPublish(body: unknown): void {
  const str = JSON.stringify(body);
  if (str.includes('reviewSubmissions') || str.includes('appAssetLibraryPlacements')) {
    throw new Error('SAFETY: request body references a publish path. Aborting.');
  }
}

// Minimal 1×1 RGB PNG bytes (no alpha channel).
const minPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cfc000000002000149e2645400000000049454e44ae426082',
  'hex',
);

function makeTempPng(): string {
  const dir = mkdtempSync(join(tmpdir(), 'asc-al-'));
  const p = join(dir, 'img.png');
  writeFileSync(p, minPng);
  return p;
}

function dryRunResult() {
  const imagePath = makeTempPng();
  const log = join(mkdtempSync(join(tmpdir(), 'asc-al-fetch-')), 'calls.log');
  const r = spawnSync(
    process.execPath,
    ['--import', './tests/fixtures/asc-fetch-stub.mjs', 'scripts/asc-asset-library.mjs'],
    {
      env: {
        PATH: process.env.PATH ?? '',
        ASC_KEY_ID: 'K',
        ASC_ISSUER_ID: 'I',
        ASC_PRIVATE_KEY: pem,
        APP_ID: '6836653723',
        IMAGE_PATH: imagePath,
        CATEGORY: 'APP_SCREENSHOTS_AND_PREVIEWS',
        DRY_RUN: 'true',
        ASC_STUB_LOG: log,
      } as unknown as NodeJS.ProcessEnv,
      encoding: 'utf8',
    },
  );
  let calls: { url: string; method: string }[] = [];
  try {
    calls = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch { /* no calls logged */ }
  return { r, calls };
}

// --- Unit: request body builders ---

test('buildReserveBody: resource type is appAssetLibraryImages', () => {
  const body = buildReserveBody({ libraryId: 'lib-1', fileName: 'a.png', fileSize: 100, category: 'APP_SCREENSHOTS_AND_PREVIEWS', referenceName: 'Shot 1' });
  assert.equal(body.data.type, 'appAssetLibraryImages');
});

test('buildReserveBody: relates to appAssetLibraries with correct id', () => {
  const body = buildReserveBody({ libraryId: 'lib-99', fileName: 'b.png', fileSize: 200, category: 'CREATIVE_ASSETS', referenceName: '' });
  assert.equal(body.data.relationships.assetLibrary.data.type, 'appAssetLibraries');
  assert.equal(body.data.relationships.assetLibrary.data.id, 'lib-99');
});

test('buildReserveBody: omits referenceName when empty string', () => {
  const body = buildReserveBody({ libraryId: 'lib-1', fileName: 'c.png', fileSize: 300, category: 'CREATIVE_ASSETS', referenceName: '' });
  assert.ok(!('referenceName' in body.data.attributes), 'referenceName should be absent');
});

test('buildReserveBody: no sourceFileChecksum (deprecated field)', () => {
  const body = buildReserveBody({ libraryId: 'lib-1', fileName: 'd.png', fileSize: 400, category: 'APP_SCREENSHOTS_AND_PREVIEWS', referenceName: '' });
  assert.ok(!JSON.stringify(body).includes('sourceFileChecksum'));
});

test('buildCommitBody: sets uploaded:true with correct type and id', () => {
  const body = buildCommitBody({ imageId: 'img-42' });
  assert.equal(body.data.type, 'appAssetLibraryImages');
  assert.equal(body.data.id, 'img-42');
  assert.equal(body.data.attributes.uploaded, true);
});

// --- Unit: safety guard ---

test('assertCannotPublish: accepts safe commit body', () => {
  assert.doesNotThrow(() => assertCannotPublish(buildCommitBody({ imageId: 'x' })));
});

test('assertCannotPublish: throws on reviewSubmissions reference', () => {
  assert.throws(() => assertCannotPublish({ data: { type: 'reviewSubmissions' } }), /SAFETY/);
});

test('assertCannotPublish: throws on appAssetLibraryPlacements reference', () => {
  assert.throws(() => assertCannotPublish({ endpoint: '/v1/appAssetLibraryPlacements' }), /SAFETY/);
});

// --- Dry-run integration: subprocess, no real API calls ---

test('dry-run: exits 0 and prints DRY RUN marker', () => {
  const { r } = dryRunResult();
  assert.equal(r.status, 0, `Script failed:\nSTDERR: ${r.stderr}\nSTDOUT: ${r.stdout}`);
  assert.ok(r.stdout.includes('DRY RUN'), 'stdout must contain DRY RUN marker');
});

test('dry-run: stdout references appAssetLibraryImages resource type', () => {
  const { r } = dryRunResult();
  assert.ok(r.stdout.includes('appAssetLibraryImages'), 'stdout must reference appAssetLibraryImages');
});

test('dry-run: makes zero API calls', () => {
  const { calls } = dryRunResult();
  assert.equal(calls.length, 0, `Dry run must make no fetch calls; got: ${JSON.stringify(calls)}`);
});

// REGRESSION: dry-run must never reference publish paths.
// This test fails if the script is modified to submit assets for review.
test('dry-run: stdout does not reference reviewSubmissions (publish guard)', () => {
  const { r } = dryRunResult();
  assert.ok(!r.stdout.includes('/v1/reviewSubmissions'), 'dry-run must not reference reviewSubmissions');
});

test('dry-run: stdout does not reference appAssetLibraryPlacements (publish guard)', () => {
  const { r } = dryRunResult();
  assert.ok(!r.stdout.includes('appAssetLibraryPlacements'), 'dry-run must not reference placement creation');
});
