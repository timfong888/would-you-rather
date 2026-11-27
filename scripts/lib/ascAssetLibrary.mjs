// Pure functions for the App Asset Library upload flow.
// Imported by scripts/asc-asset-library.mjs and tests/unit/asc-asset-library.test.ts.

export function buildReserveBody({ libraryId, fileName, fileSize, category, referenceName }) {
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
        assetLibrary: {
          data: { type: 'appAssetLibraries', id: libraryId },
        },
      },
    },
  };
}

export function buildCommitBody({ imageId }) {
  return {
    data: {
      type: 'appAssetLibraryImages',
      id: imageId,
      attributes: { uploaded: true },
    },
  };
}

// Safety guard: throws if body references a publish path.
// An uploaded+committed asset lands in PREPARE_FOR_SUBMISSION and cannot go
// live without a placement + review submission — operations deliberately absent
// from the asset-library workflow.
export function assertCannotPublish(body) {
  const str = JSON.stringify(body);
  if (str.includes('reviewSubmissions') || str.includes('appAssetLibraryPlacements')) {
    throw new Error('SAFETY: request body references a publish path. Aborting.');
  }
}
