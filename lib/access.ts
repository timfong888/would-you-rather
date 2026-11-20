/**
 * Whether the user may play every question in a category. Pure, unit-tested;
 * contexts/UnlockedContext.tsx feeds it live state, so a purchase that adds an
 * entitlement opens the questions on the next render, without a reload.
 */
import { ENTITLEMENT_ALL, isCategoryEntitled } from './catalog';

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
