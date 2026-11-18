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
import { isCategoryEntitled } from '@/lib/catalog';
import { purchases } from '@/lib/purchases';

interface UnlockedContextValue {
  /** True when the user may play every question in the category. */
  isUnlocked: (id: CategoryId) => boolean;
  /** Record a (purchased) unlock for a single category. */
  unlock: (id: CategoryId) => void;
  /** Clear purchased unlocks. Owner access is left in place. */
  reset: () => void;
  /** True when real store purchases are wired up in this build (native + RevenueCat key). */
  purchasesAvailable: boolean;
  /** Replace the active RevenueCat entitlement ids (after a purchase or restore). */
  applyEntitlements: (active: string[]) => void;

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
  purchasesAvailable: false,
  applyEntitlements: () => {},
  ownerAccess: false,
  ownerAccessAvailable: false,
  grantOwnerAccess: async () => false,
  revokeOwnerAccess: () => {},
});

const STORAGE_KEY = 'wyr_unlocked_categories';

function loadFromStorage(): Set<string> {
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
  const [unlocked, setUnlocked] = useState<Set<string>>(() => loadFromStorage());
  const [ownerAccess, setOwnerAccess] = useState<boolean>(() => loadOwnerAccess());
  // Active RevenueCat entitlement ids. Empty on web, where purchases are unavailable.
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
    return () => {
      cancelled = true;
      unsubscribe();
      sub.remove();
    };
  }, []);

  const applyEntitlements = useCallback((active: string[]) => setEntitlements(new Set(active)), []);

  // Tag every analytics event while owner access is on so tester activity
  // can be excluded from the paywall funnel.
  useEffect(() => {
    setOwnerAccessFlag(ownerAccess);
  }, [ownerAccess]);

  const isUnlocked = useCallback(
    (id: CategoryId) => ownerAccess || unlocked.has(id) || isCategoryEntitled(entitlements, id),
    [ownerAccess, unlocked, entitlements],
  );

  const unlock = useCallback((id: CategoryId) => {
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
        purchasesAvailable: purchases.isAvailable(),
        applyEntitlements,
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
