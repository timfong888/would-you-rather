import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { Access, CategoryDef, CategoryId } from '@/constants/questions';
import {
  loadOwnerAccess,
  saveOwnerAccess,
  verifyOwnerAccessCode,
  isOwnerAccessConfigured,
} from '@/lib/ownerAccess';
import { setOwnerAccessFlag } from '@/lib/analytics';
import { ENTITLEMENT_ALL, FALLBACK_PRICE_ALL, FALLBACK_PRICE_CATEGORY, PRODUCT_ALL, productForCategory } from '@/lib/catalog';
import { canPlayCategory, openTranchesFor } from '@/lib/access';
import { purchases } from '@/lib/purchases';
import { webFreeUnlockAllowed } from '@/lib/testUnlockPolicy';

/**
 * Temporary production web free unlock (Tim, 2026-11-21, "128 b"), until web
 * payments exist. Web only, on when EXPO_PUBLIC_WEB_FREE_UNLOCK is "1" on the
 * Vercel deploy (production included). Off: delete the Vercel variable and
 * redeploy. Previews test real purchases against RevenueCat's Test Store instead.
 */
export const WEB_FREE_UNLOCK =
  Platform.OS === 'web' &&
  process.env.EXPO_PUBLIC_WEB_FREE_UNLOCK === '1' &&
  webFreeUnlockAllowed(process.env.EXPO_PUBLIC_WEB_FREE_UNLOCK, Platform.OS);

/** A free (no payment) unlock is compiled into this build: only the temporary web one. */
export const FREE_UNLOCK = WEB_FREE_UNLOCK;

interface UnlockedContextValue {
  /** True when the user may play every question in the category. */
  isUnlocked: (id: CategoryId) => boolean;
  /** What the player may open in a category: everything, nothing, or the owned tranche numbers (#238). Pass it to isQuestionLocked. */
  openTranches: (category: CategoryDef) => Access;
  /** Free unlock for a single category. A no-op unless FREE_UNLOCK (test or temporary web). Kids and teen use it; it opens everything. */
  unlock: (id: CategoryId) => void;
  /** Free "unlock every category" (mirrors the $4.99 pack). A no-op unless FREE_UNLOCK. */
  unlockAll: () => void;
  /** Clear free unlocks. Owner access and purchases are left in place. */
  reset: () => void;
  /** True when real purchases are wired up: iOS (App Store key) or web (Web Billing key). */
  purchasesAvailable: boolean;
  /**
   * True once the first entitlement fetch has settled (or purchases are off).
   * Until then isUnlocked() can say false for a buyer, so screens must not
   * redirect to the paywall or count a paywall view before this is true.
   */
  entitlementsLoaded: boolean;
  /** Replace the active RevenueCat entitlement ids (after a purchase or restore). */
  applyEntitlements: (active: string[]) => void;
  /** Price label for a category unlock: the store price when loaded, else the approved $1.99. */
  priceForCategory: (id: string) => string;
  /** Price label for the all-categories pack: the store price when loaded, else the approved $4.99. */
  priceForAll: () => string;

  /** Owner access: bypass the payment flow for the owner / testers. */
  ownerAccess: boolean;
  ownerAccessAvailable: boolean;
  grantOwnerAccess: (code: string) => Promise<boolean>;
  revokeOwnerAccess: () => void;
}

const UnlockedContext = createContext<UnlockedContextValue>({
  isUnlocked: () => false,
  openTranches: () => false,
  unlock: () => {},
  unlockAll: () => {},
  reset: () => {},
  purchasesAvailable: false,
  entitlementsLoaded: true,
  applyEntitlements: () => {},
  priceForCategory: () => FALLBACK_PRICE_CATEGORY,
  priceForAll: () => FALLBACK_PRICE_ALL,
  ownerAccess: false,
  ownerAccessAvailable: false,
  grantOwnerAccess: async () => false,
  revokeOwnerAccess: () => {},
});

const STORAGE_KEY = 'wyr_unlocked_categories';
const ENTITLEMENTS_LOAD_TIMEOUT_MS = 8000;

function loadFromStorage(): Set<string> {
  // Unlocks stored by the old simulated checkout (#53), the test unlock or the
  // temporary web free unlock only count while a free unlock exists. Without
  // one, access comes from RevenueCat entitlements (or owner access) only.
  if (!FREE_UNLOCK) return new Set();
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
  }
  return new Set();
}

function saveToStorage(set: Set<string>) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {}
  }
}

export function UnlockedProvider({ children }: { children: React.ReactNode }) {
  // Free unlocks (empty, and never written, unless FREE_UNLOCK).
  const [unlocked, setUnlocked] = useState<Set<string>>(() => loadFromStorage());
  const [ownerAccess, setOwnerAccess] = useState<boolean>(() => loadOwnerAccess());
  // Active RevenueCat entitlement ids (App Store on iOS, Web Billing on web).
  const [entitlements, setEntitlements] = useState<Set<string>>(() => new Set());
  const [entitlementsLoaded, setEntitlementsLoaded] = useState<boolean>(() => !purchases.isAvailable());

  // Bootstrap from RevenueCat on launch and stay in sync: the listener fires on
  // purchase, restore, refund and expiry, so access is revoked without a restart.
  useEffect(() => {
    if (!purchases.isAvailable()) return;
    let cancelled = false;
    const markLoaded = () => {
      if (!cancelled) setEntitlementsLoaded(true);
    };
    // A hung network must not hold screens on "checking" forever.
    const loadTimeout = setTimeout(markLoaded, ENTITLEMENTS_LOAD_TIMEOUT_MS);
    purchases
      .getEntitlements()
      .then((active) => {
        if (!cancelled) setEntitlements(new Set(active));
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(loadTimeout);
        markLoaded();
      });
    const unsubscribe = purchases.onEntitlementsChange((active) => setEntitlements(new Set(active)));
    // RevenueCat does not push backend changes (refund, promo expiry) to the
    // listener; they appear on the next SDK fetch. Refresh whenever the app
    // returns to the foreground so revocation does not need a restart.
    const refresh = () =>
      purchases
        .getEntitlements()
        .then((active) => {
          if (!cancelled) setEntitlements(new Set(active));
        })
        .catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    // The SDK refetches at most every few minutes anyway; poll on that cadence
    // so a long foreground session also picks up a refund or expiry.
    const timer = setInterval(refresh, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      unsubscribe();
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  const applyEntitlements = useCallback((active: string[]) => setEntitlements(new Set(active)), []);

  // Localized store prices (empty until loaded, or when purchases are unavailable).
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!purchases.isAvailable()) return;
    let cancelled = false;
    purchases
      .getPrices()
      .then((p) => {
        if (!cancelled) setPrices(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const priceForCategory = useCallback(
    (id: string) => prices[productForCategory(id)] ?? FALLBACK_PRICE_CATEGORY,
    [prices],
  );
  const priceForAll = useCallback(() => prices[PRODUCT_ALL] ?? FALLBACK_PRICE_ALL, [prices]);

  // Tag every analytics event while owner access is on so tester activity
  // can be excluded from the paywall funnel.
  useEffect(() => {
    setOwnerAccessFlag(ownerAccess);
  }, [ownerAccess]);

  const openTranches = useCallback(
    (category: CategoryDef) =>
      openTranchesFor({ ownerAccess, entitlements, testUnlocks: unlocked, testUnlockEnabled: FREE_UNLOCK }, category),
    [ownerAccess, unlocked, entitlements],
  );

  const isUnlocked = useCallback(
    (id: CategoryId) =>
      canPlayCategory({ ownerAccess, entitlements, testUnlocks: unlocked, testUnlockEnabled: FREE_UNLOCK }, id),
    [ownerAccess, unlocked, entitlements],
  );

  const unlock = useCallback((id: CategoryId) => {
    if (!FREE_UNLOCK) return;
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const unlockAll = useCallback(() => unlock(ENTITLEMENT_ALL as CategoryId), [unlock]);

  const reset = useCallback(() => {
    setUnlocked(() => {
      const empty = new Set<string>();
      saveToStorage(empty);
      return empty;
    });
  }, []);

  const grantOwnerAccess = useCallback(async (code: string) => {
    const ok = await verifyOwnerAccessCode(code);
    if (ok) {
      saveOwnerAccess(true);
      // Flip the analytics flag synchronously so the very next event (the
      // caller's owner_access_granted) is already tagged; the effect below
      // would only catch up on the next render.
      setOwnerAccessFlag(true);
      setOwnerAccess(true);
    }
    return ok;
  }, []);

  const revokeOwnerAccess = useCallback(() => {
    saveOwnerAccess(false);
    setOwnerAccessFlag(false);
    setOwnerAccess(false);
  }, []);

  return (
    <UnlockedContext.Provider
      value={{
        isUnlocked,
        openTranches,
        unlock,
        unlockAll,
        reset,
        purchasesAvailable: purchases.isAvailable(),
        entitlementsLoaded,
        applyEntitlements,
        priceForCategory,
        priceForAll,
        ownerAccess,
        ownerAccessAvailable: isOwnerAccessConfigured(),
        grantOwnerAccess,
        revokeOwnerAccess,
      }}
    >
      {children}
    </UnlockedContext.Provider>
  );
}

export function useUnlocked() {
  return useContext(UnlockedContext);
}
