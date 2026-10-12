import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import type { CategoryId } from '@/constants/questions';
import {
  loadOwnerAccess,
  saveOwnerAccess,
  verifyOwnerAccessCode,
  isOwnerAccessConfigured,
} from '@/lib/ownerAccess';
import { setOwnerAccessFlag } from '@/lib/analytics';

interface UnlockedContextValue {
  /** True when the user may play every question in the category. */
  isUnlocked: (id: CategoryId) => boolean;
  /** Record a (purchased) unlock for a single category. */
  unlock: (id: CategoryId) => void;
  /** Clear purchased unlocks. Owner access is left in place. */
  reset: () => void;

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

  // Tag every analytics event while owner access is on so tester activity
  // can be excluded from the paywall funnel.
  useEffect(() => {
    setOwnerAccessFlag(ownerAccess);
  }, [ownerAccess]);

  const isUnlocked = useCallback(
    (id: CategoryId) => ownerAccess || unlocked.has(id),
    [ownerAccess, unlocked],
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
