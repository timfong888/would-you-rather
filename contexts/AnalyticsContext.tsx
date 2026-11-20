import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { track, ensureSessionInit, getSession, subscribeSession, type SessionInfo } from '@/lib/analytics';
import { usePathname } from 'expo-router';
import { purgeVisitorId, setCurrentRoute } from '@/lib/analytics';
import { isKidsPath } from '@/lib/kidsPaths';
import { purgeKidsVoteStorage } from '@/lib/votes';

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
  const pathname = usePathname();
  // The router path is the analytics gate's source of truth (web and native): set it during render so
  // it is current before the session is initialised and before any child effect runs.
  setCurrentRoute(pathname);
  // Initialise during render so identity, the first-session flag and the first-touch
  // properties exist before any child effect (page_view, vote-retry flush) runs. Native stays
  // closed until the route is known and initialises from the effect below.
  const [ctx, setCtx] = useState<AnalyticsContextValue>(() => toValue(ensureSessionInit()));
  const announced = useRef<SessionInfo | null>(null);

  // Kids routes keep no persisted visitor ID (COPPA): remove one a previous build or visit stored,
  // whenever such a route is shown (including after in-app navigation to it).
  useEffect(() => {
    if (pathname && isKidsPath(pathname)) {
      purgeVisitorId();
      purgeKidsVoteStorage();
    }
  }, [pathname]);

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
