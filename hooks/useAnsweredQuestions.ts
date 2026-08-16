import { useState, useCallback } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = 'wyr_answered_questions';

type AnsweredMap = Record<string, 'A' | 'B'>;

function loadAnswered(): AnsweredMap {
  if (Platform.OS !== 'web') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnsweredMap) : {};
  } catch {
    return {};
  }
}

function saveAnswered(map: AnsweredMap): void {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function useAnsweredQuestions() {
  const [answered, setAnswered] = useState<AnsweredMap>(() => loadAnswered());

  const markAnswered = useCallback((questionId: string, choice: 'A' | 'B') => {
    setAnswered((prev) => {
      const next = { ...prev, [questionId]: choice };
      saveAnswered(next);
      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    setAnswered(loadAnswered());
  }, []);

  const reset = useCallback(() => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    setAnswered({});
  }, []);

  return { answered, markAnswered, refresh, reset };
}
