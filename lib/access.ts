/**
 * Whether the user may play every question in a category. Pure, unit-tested;
 * contexts/UnlockedContext.tsx feeds it live state, so a purchase that adds an
 * entitlement opens the questions on the next render, without a reload.
 */
import { ENTITLEMENT_ALL, entitlementForCategory, isCategoryEntitled } from './catalog';
import { getTranches, type Access, type CategoryDef } from '../constants/questions';

export interface AccessState {
  /** Owner code redeemed (web and native dev builds only, lib/ownerAccessPolicy.ts). */
  ownerAccess: boolean;
  /** Active RevenueCat entitlement ids (App Store or Web Billing). */
  entitlements: ReadonlySet<string>;
  /** Categories opened with the free test unlock; ENTITLEMENT_ALL means every category (test pack). */
  testUnlocks: ReadonlySet<string>;
  /** False on production: test unlocks (and old simulated-checkout unlocks) are ignored. */
  testUnlockEnabled: boolean;
}

export function canPlayCategory(state: AccessState, id: string): boolean {
  if (state.ownerAccess) return true;
  if (isCategoryEntitled(state.entitlements, id)) return true;
  return state.testUnlockEnabled && (state.testUnlocks.has(id) || state.testUnlocks.has(ENTITLEMENT_ALL));
}

/**
 * What the player may open in a category. Owner access, a test unlock and `premium_all` open everything. Otherwise
 * `cat_<id>` (the product the category sells, D22 #255) opens every question after the free ones. `premium_all` and
 * the all-categories test unlock never open kids or teen. The web free unlock stores the bare category id and opens
 * the whole category, the same as a purchase.
 */
export function openTranchesFor(state: AccessState, category: CategoryDef): Access {
  if (state.ownerAccess) return true;
  // premium_all and the all-categories test unlock open grown-up categories only (kids spec 3.4, 3.1).
  if (category.audience === 'adult') {
    if (state.entitlements.has(ENTITLEMENT_ALL)) return true;
    if (state.testUnlockEnabled && state.testUnlocks.has(ENTITLEMENT_ALL)) return true;
  }
  const owned = new Set<number>();
  const key = entitlementForCategory(category.id);
  const bought = state.entitlements.has(key) || (state.testUnlockEnabled && (state.testUnlocks.has(key) || state.testUnlocks.has(category.id)));
  if (bought) for (const t of getTranches(category)) owned.add(t.k);
  return owned;
}

/** True when the entitlements include `premium_all` or this category's own entitlement (used to word a restore). */
export function holdsAnyTranche(entitlements: Iterable<string>, categoryId: string): boolean {
  const key = entitlementForCategory(categoryId);
  for (const e of entitlements) if (e === ENTITLEMENT_ALL || e === key) return true;
  return false;
}

/**
 * A restore counts as success only when the restored entitlements open what the paywall offers: the category's own
 * entitlement, or `premium_all` for a grown-up category (never for kids or teen).
 */
export function restoreOpensTranche(entitlements: Iterable<string>, category: CategoryDef, _k = 1): boolean {
  const list = [...entitlements];
  if (category.audience === 'adult' && list.includes(ENTITLEMENT_ALL)) return true;
  return list.includes(entitlementForCategory(category.id));
}

/**
 * What a question screen does with a question that may be locked. A buyer's
 * entitlements arrive asynchronously, so until the first fetch settles a
 * locked-looking question shows "checking" instead of bouncing to the paywall.
 */
export type QuestionGate = 'play' | 'checking' | 'paywall';

export function questionGate(input: { locked: boolean; arrivedViaShare: boolean; entitlementsLoaded: boolean }): QuestionGate {
  if (!input.locked || input.arrivedViaShare) return 'play';
  return input.entitlementsLoaded ? 'paywall' : 'checking';
}

/**
 * What the paywall does on entry, decided once: wait until entitlements have
 * loaded and navigation is ready; then an entitled visitor goes back to the
 * category (not a paywall view) and anyone else is counted as a paywall view.
 */
export type PaywallEntry = 'wait' | 'to-category' | 'track-view';

export function paywallEntry(input: { entitlementsLoaded: boolean; navReady: boolean; unlocked: boolean }): PaywallEntry {
  if (!input.entitlementsLoaded || !input.navReady) return 'wait';
  return input.unlocked ? 'to-category' : 'track-view';
}

/** True when the tranche the paywall offered at entry is now open (a late entitlement landed). */
export function offeredTrancheOpen(access: Access, offeredK: number | undefined): boolean {
  if (offeredK === undefined) return false;
  return access === true || (access instanceof Set && access.has(offeredK));
}

/**
 * After the entry decision, entitlements can still arrive late (the first fetch
 * outlived the load timeout on a slow connection). If the category becomes
 * unlocked while the paywall is idle, send the visitor to it instead of
 * offering to sell what they own. Never while a purchase, restore or owner
 * code is in flight: those show their own success screen.
 */
export function paywallLateUnlock(input: {
  entryChecked: boolean;
  navReady: boolean;
  unlocked: boolean;
  idle: boolean;
  redeemingCode: boolean;
}): boolean {
  return input.entryChecked && input.navReady && input.unlocked && input.idle && !input.redeemingCode;
}
