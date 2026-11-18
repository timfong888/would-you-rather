import { useEffect, useState } from 'react';
import { fetchTally } from '@/lib/votes';
import { formatResult, type ResultDisplay } from '@/lib/results';

/**
 * Read-only result for a question, for screens that only look at results
 * (they never cast a vote). Starts as the invite, so nothing numeric shows
 * until the server has answered.
 */
export function useTally(questionId: string | undefined): ResultDisplay {
  const [display, setDisplay] = useState<ResultDisplay>({ kind: 'invite' });
  useEffect(() => {
    let live = true;
    setDisplay({ kind: 'invite' });
    if (!questionId) return;
    fetchTally(questionId).then((t) => {
      if (live) setDisplay(formatResult(t));
    });
    return () => {
      live = false;
    };
  }, [questionId]);
  return display;
}
