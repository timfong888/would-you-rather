import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { track, identify, getOrCreateVisitorId } from '@/lib/analytics';

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
  const [ctx, setCtx] = useState<AnalyticsContextValue>({
    visitorId: '',
    incomingLinkId: null,
    incomingGeneration: 0,
  });

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const { id: visitorId, isNew } = getOrCreateVisitorId();
    identify(visitorId);

    let linkId: string | null = null;
    let generation = 0;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      linkId = params.get('link_id');
      generation = parseInt(params.get('gen') ?? '0', 10) || 0;
    }

    setCtx({ visitorId, incomingLinkId: linkId, incomingGeneration: generation });

    track('session_start', {
      source: linkId ? 'shared_link' : 'direct',
      link_id: linkId ?? undefined,
      visitor_id: visitorId,
    });

    if (linkId) {
      track('shared_link_opened', {
        link_id: linkId,
        is_new_visitor: isNew,
        generation,
        visitor_id: visitorId,
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
