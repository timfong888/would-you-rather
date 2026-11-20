import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { CategoryId } from '@/constants/questions';
import {
  loadOwnerAccess,
  saveOwnerAccess,
  verifyOwnerAccessCode,
  isOwnerAccessConfigured,
} from '@/lib/ownerAccess';
import { setOwnerAccessFlag } from '@/lib/analytics';
import { FALLBACK_PRICE_ALL, FALLBACK_PRICE_CATEGORY, PRODUCT_ALL, productForCategory } from '@/lib/catalog';
import { canPlayCategory } from '@/lib/access';
import { purchases } from '@/lib/purchases';
import { testUnlockAllowed } from '@/lib/testUnlockPolicy';

/**
 * Free test unlock (no payment). Off unless EXPO_PUBLIC_TEST_UNLOCK is "1" on a
 * preview or development build; never on production (lib/testUnlockPolicy.ts).
 * The inline env comparison lets Metro inline the value so the minifier drops
 * the test-only paths from builds without the flag.
 */
export const TEST_UNLOCK =
  process.env.EXPO_PUBLIC_TEST_UNLOCK === '1' &&
  testUnlockAllowed(process.env.EXPO_PUBLIC_DEPLOY_ENV, process.env.EXPO_PUBLIC_TEST_UNLOCK);

interface UnlockedContextValue {
  /** True when the user may play every question in the category. */
  isUnlocked: (id: CategoryId) => boolean;
  /** Test-only free unlock for a single category. A no-op unless TEST_UNLOCK. */
  unlock: (id: CategoryId) => void;
  /** Clear test unlocks. Owner access and purchases are left in place. */
  reset: () => void;
  /** True when the free test unlock is compiled into this build (never on production). */
  testUnlockEnabled: boolean;
  /** True when real purchases are wired up: iOS (App Store key) or web (Web Billing key). */
  purchasesAvailable: boolean;
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
  unlock: () => {},
  reset: () => {},
  testUnlockEnabled: false,
  purchasesAvailable: false,
  applyEntitlements: () => {},
  priceForCategory: () => FALLBACK_PRICE_CATEGORY,
  priceForAll: () => FALLBACK_PRICE_ALL,
  ownerAccess: false,
  ownerAccessAvailable: false,
  grantOwnerAccess: async () => false,
  revokeOwnerAccess: () => {},
});

const STORAGE_KEY = 'wyr_unlocked_categories';

function loadFromStorage(): Set<string> {
  // Unlocks stored by the old simulated checkout (#53) or the test unlock only
  // count where the test unlock exists. Production ignores them: access there
  // comes from RevenueCat entitlements (or owner access) only.
  if (!TEST_UNLOCK) return new Set();
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
  // Test unlocks (empty, and never written, unless TEST_UNLOCK).
  const [unlocked, setUnlocked] = useState<Set<string>>(() => loadFromStorage());
  const [ownerAccess, setOwnerAccess] = useState<boolean>(() => loadOwnerAccess());
  // Active RevenueCat entitlement ids (App Store on iOS, Web Billing on web).
  const [entitlements, setEntitlements] = useState<Set<string>>(() => new Set());

  // Bootstrap from RevenueCat on launch and stay in sync: the listener fires on
  // purchase, restore, refund and expiry, so access is revoked without a restart.
  useEffect(() => {
    if (!purchases.isAvailable()) return;
    let cancelled = false;
    purchases
      .getEntitlements()
      .then((active) => {
        if (!cancelled) setEntitlements(new Set(active));
      })
      .catch(() => {});
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

  const isUnlocked = useCallback(
    (id: CategoryId) =>
      canPlayCategory({ ownerAccess, entitlements, testUnlocks: unlocked, testUnlockEnabled: TEST_UNLOCK }, id),
    [ownerAccess, unlocked, entitlements],
  );

  const unlock = useCallback((id: CategoryId) => {
    if (!TEST_UNLOCK) return;
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveToStorage(next);
      return next;
    });
  }, []);

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
        unlock,
        reset,
        testUnlockEnabled: TEST_UNLOCK,
        purchasesAvailable: purchases.isAvailable(),
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
