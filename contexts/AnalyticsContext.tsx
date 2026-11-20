import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { track, identify, getOrCreateVisitorId, purgeVisitorId, setCurrentRoute } from '@/lib/analytics';
import { isKidsPath } from '@/lib/kidsPaths';
import { purgeKidsVoteStorage } from '@/lib/votes';

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
  const pathname = usePathname();
  // Native analytics gate: set during render so it is current before any child effect runs.
  if (Platform.OS !== 'web') setCurrentRoute(pathname);

  // Kids routes keep no persisted visitor ID (COPPA): remove one if it exists, whenever such a
  // route is shown (including after navigating there inside the app).
  useEffect(() => {
    if (pathname && isKidsPath(pathname)) {
      purgeVisitorId();
      purgeKidsVoteStorage();
    }
  }, [pathname]);

  const [ctx, setCtx] = useState<AnalyticsContextValue>({
    visitorId: '',
    incomingLinkId: null,
    incomingGeneration: 0,
  });

  useEffect(() => {
    // Wait for the first known route: the kids check needs it (native has no window.location).
    if (fired.current || !pathname) return;
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
  }, [pathname]);

  return (
    <AnalyticsContext.Provider value={ctx}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}
