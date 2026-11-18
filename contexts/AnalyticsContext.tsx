import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { track, ensureSessionInit } from '@/lib/analytics';

interface AnalyticsContextValue {
  /** Anonymous ID persisted across sessions. */
  visitorId: string;
  /** link_id from the URL if this session arrived via a shared link. */
  incomingLinkId: string | null;
  /** Generation hop count from the URL (0 = direct, 1 = first shared link, …). */
  incomingGeneration: number;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  visitorId: '',
  incomingLinkId: null,
  incomingGeneration: 0,
});

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const fired = useRef(false);
  // Initialise during render so identity, the first-session flag and the first-touch
  // properties exist before any child effect (page_view, vote-retry flush) runs.
  const [session] = useState(() => ensureSessionInit());
  const ctx: AnalyticsContextValue = {
    visitorId: session?.visitorId ?? '',
    incomingLinkId: session?.linkId ?? null,
    incomingGeneration: session?.generation ?? 0,
  };

  useEffect(() => {
    const s = ensureSessionInit();
    if (!s || fired.current) return;
    fired.current = true;

    track('session_start', {
      ...s.attribution,
      source: s.linkId ? 'shared_link' : s.attribution.channel,
      link_id: s.linkId ?? undefined,
      visitor_id: s.visitorId,
      is_new_visitor: s.isNew,
    });

    if (s.linkId) {
      track('shared_link_opened', {
        link_id: s.linkId,
        is_new_visitor: s.isNew,
        generation: s.generation,
        visitor_id: s.visitorId,
      });
    }
  }, []);

  return (
    <AnalyticsContext.Provider value={ctx}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}
