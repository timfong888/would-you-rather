import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { isKidsQuestion } from '@/lib/kidsPaths';
import { withoutKidsAnswers } from '@/lib/votes-core';

const STORAGE_KEY = 'wyr_answered_questions';

type AnsweredMap = Record<string, 'A' | 'B'>;

function loadAnswered(): AnsweredMap {
  if (Platform.OS !== 'web') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? withoutKidsAnswers(JSON.parse(raw) as AnsweredMap) : {};
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
      // Kids questions (COPPA): kept in memory for this screen only, never written to storage.
      if (!isKidsQuestion(questionId)) saveAnswered(withoutKidsAnswers(next));
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
