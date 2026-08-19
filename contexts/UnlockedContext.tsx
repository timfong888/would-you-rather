import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { CATEGORIES } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { configurePurchases, hasPremiumEntitlement } from '@/lib/purchases';

interface UnlockedContextValue {
  isUnlocked: (id: CategoryId) => boolean;
  unlock: (id: CategoryId) => void;
  unlockAll: () => void;
  reset: () => void;
}

const UnlockedContext = createContext<UnlockedContextValue>({
  isUnlocked: () => false,
  unlock: () => {},
  unlockAll: () => {},
  reset: () => {},
});

const STORAGE_KEY = 'wyr_unlocked_categories';

const PREMIUM_CATEGORY_IDS = CATEGORIES
  .filter((c) => c.tier === 'premium')
  .map((c) => c.id);

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

  useEffect(() => {
    async function bootstrapFromRevenueCat() {
      await configurePurchases();
      const hasPremium = await hasPremiumEntitlement();
      if (hasPremium) {
        setUnlocked(new Set(PREMIUM_CATEGORY_IDS));
      }
    }
    if (Platform.OS !== 'web') {
      bootstrapFromRevenueCat();
    }
  }, []);

  const isUnlocked = useCallback((id: CategoryId) => unlocked.has(id), [unlocked]);

  const unlock = useCallback((id: CategoryId) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const unlockAll = useCallback(() => {
    setUnlocked(() => {
      const next = new Set(PREMIUM_CATEGORY_IDS);
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

  return (
    <UnlockedContext.Provider value={{ isUnlocked, unlock, unlockAll, reset }}>
      {children}
    </UnlockedContext.Provider>
  );
}

export function useUnlocked() {
  return useContext(UnlockedContext);
}
