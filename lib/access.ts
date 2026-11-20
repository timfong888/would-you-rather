/**
 * Whether the user may play every question in a category. Pure, unit-tested;
 * contexts/UnlockedContext.tsx feeds it live state, so a purchase that adds an
 * entitlement opens the questions on the next render, without a reload.
 */
import { isCategoryEntitled } from './catalog';

export interface AccessState {
  /** Owner code redeemed (web and native dev builds only, lib/ownerAccessPolicy.ts). */
  ownerAccess: boolean;
  /** Active RevenueCat entitlement ids (App Store or Web Billing). */
  entitlements: ReadonlySet<string>;
  /** Categories opened with the free test unlock. */
  testUnlocks: ReadonlySet<string>;
  /** False on production: test unlocks (and old simulated-checkout unlocks) are ignored. */
  testUnlockEnabled: boolean;
}

export function canPlayCategory(state: AccessState, id: string): boolean {
  if (state.ownerAccess) return true;
  if (isCategoryEntitled(state.entitlements, id)) return true;
  return state.testUnlockEnabled && state.testUnlocks.has(id);
}
