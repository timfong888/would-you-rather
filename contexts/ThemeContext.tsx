import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS, type ThemeColors } from '@/constants/theme';

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: LIGHT_COLORS,
  toggleTheme: () => {},
});

const STORAGE_KEY = 'wyr_theme_dark';

function loadIsDark(): boolean {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {}
  }
  return false;
}

function saveIsDark(value: boolean) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
    } catch {}
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => loadIsDark());

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      saveIsDark(next);
      return next;
    });
  }, []);

  const colors = useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
