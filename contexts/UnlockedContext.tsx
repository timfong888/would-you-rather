import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import type { CategoryId } from '@/constants/questions';

interface UnlockedContextValue {
  isUnlocked: (id: CategoryId) => boolean;
  unlock: (id: CategoryId) => void;
}

const UnlockedContext = createContext<UnlockedContextValue>({
  isUnlocked: () => false,
  unlock: () => {},
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

  const isUnlocked = useCallback((id: CategoryId) => unlocked.has(id), [unlocked]);

  const unlock = useCallback((id: CategoryId) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveToStorage(next);
      return next;
    });
  }, []);

  return (
    <UnlockedContext.Provider value={{ isUnlocked, unlock }}>
      {children}
    </UnlockedContext.Provider>
  );
}

export function useUnlocked() {
  return useContext(UnlockedContext);
}
