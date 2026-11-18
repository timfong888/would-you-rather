import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { track, ensureSessionInit, getSession, subscribeSession, type SessionInfo } from '@/lib/analytics';

interface AnalyticsContextValue {
  /** Anonymous ID persisted across sessions ('' while on a kids route, where there is none). */
  visitorId: string;
  /** link_id from the URL if this session arrived via a shared link. */
  incomingLinkId: string | null;
  /** Generation hop count from the URL (0 = direct, 1 = first shared link, …). */
  incomingGeneration: number;
}

const EMPTY: AnalyticsContextValue = { visitorId: '', incomingLinkId: null, incomingGeneration: 0 };

const AnalyticsContext = createContext<AnalyticsContextValue>(EMPTY);

const toValue = (s: SessionInfo | null): AnalyticsContextValue =>
  s ? { visitorId: s.visitorId, incomingLinkId: s.linkId, incomingGeneration: s.generation } : EMPTY;

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  // Initialise during render so identity, the first-session flag and the first-touch
  // properties exist before any child effect (page_view, vote-retry flush) runs.
  const [ctx, setCtx] = useState<AnalyticsContextValue>(() => toValue(ensureSessionInit()));
  const announced = useRef<SessionInfo | null>(null);

  useEffect(() => {
    // The allowed session can change after mount: it is cleared on kids routes and created
    // again on the next allowed page. Keep the context in step and announce each new session.
    const sync = (s: SessionInfo | null) => {
      setCtx(toValue(s));
      if (!s || announced.current === s) return;
      announced.current = s;
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
    };
    const unsubscribe = subscribeSession(sync);
    sync(getSession() ?? ensureSessionInit());
    return unsubscribe;
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
