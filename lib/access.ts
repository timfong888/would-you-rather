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
 * What the player may open in a category (issue #238). Owner access, a test unlock
 * and `premium_all` open every tranche. Otherwise a grown-up category opens the
 * tranches whose entitlement is held: tranche 1 is `cat_<id>` (the id that exists
 * today), tranche k >= 2 is `cat_<id>_<k>`. Kids and teen keep the all-or-nothing
 * rule until their own tranches (Unit 4 of #124).
 */
export function openTranchesFor(state: AccessState, category: CategoryDef): Access {
  if (category.audience !== 'adult') return canPlayCategory(state, category.id);
  if (state.ownerAccess || state.entitlements.has(ENTITLEMENT_ALL)) return true;
  if (state.testUnlockEnabled && (state.testUnlocks.has(category.id) || state.testUnlocks.has(ENTITLEMENT_ALL))) return true;
  const owned = new Set<number>();
  for (const t of getTranches(category)) {
    const entitlement = t.k === 1 ? entitlementForCategory(category.id) : `${entitlementForCategory(category.id)}_${t.k}`;
    if (state.entitlements.has(entitlement)) owned.add(t.k);
  }
  return owned;
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
