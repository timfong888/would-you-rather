// Pure helpers for scripts/asc-apps.mjs (read-only App Store Connect app lookup).

/** Case-insensitive "contains" match on an app's name or bundle ID. Empty needle matches everything. */
export function matchesApp(attrs, needle) {
  const n = String(needle ?? '').trim().toLowerCase();
  if (!n) return true;
  return [attrs?.name, attrs?.bundleId].some((v) => String(v ?? '').toLowerCase().includes(n));
}

/** Human label for the store state. Apple's READY_FOR_SALE is what "live on the App Store" means. */
export function stateLabel(state) {
  switch (state) {
    case 'READY_FOR_SALE': return 'LIVE (ready for sale)';
    case 'PENDING_DEVELOPER_RELEASE': return 'approved, waiting for developer release';
    case 'PENDING_APPLE_RELEASE': return 'approved, waiting for Apple release';
    case 'IN_REVIEW': return 'in review';
    case 'WAITING_FOR_REVIEW': return 'waiting for review';
    case 'PREPARE_FOR_SUBMISSION': return 'prepare for submission';
    case 'DEVELOPER_REJECTED': return 'developer rejected';
    case 'REJECTED': return 'rejected';
    case 'METADATA_REJECTED': return 'metadata rejected';
    case 'REMOVED_FROM_SALE':
    case 'DEVELOPER_REMOVED_FROM_SALE': return 'REMOVED from sale';
    case 'REPLACED_WITH_NEW_VERSION': return 'replaced by a newer version';
    default: return state ? String(state).toLowerCase() : 'unknown';
  }
}

/** The app is live when any version is READY_FOR_SALE. */
export function isLive(versions) {
  return (versions ?? []).some((v) => v?.attributes?.appStoreState === 'READY_FOR_SALE' || v?.attributes?.appVersionState === 'READY_FOR_SALE');
}
