/**
 * Pure analytics gating, free of React Native and the PostHog SDK so it can be unit tested.
 * Rule (COPPA): kids content never sends analytics, on web or native.
 */
import { analyticsAllowed } from '@/lib/visitorId';

export type Props = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsClient {
  capture(event: string, props?: Props): void;
  identify(distinctId: string, props?: Props): void;
}

/**
 * True when analytics may run for the current route.
 * Web: judged from the browser path. Native: judged from the current router path, and CLOSED
 * until that path is known, so nothing is sent before we can tell whether it is kids content.
 */
export function analyticsOnFor(input: {
  platform: string;
  pathname: string | null | undefined;
  isKids: (pathname: string) => boolean;
}): boolean {
  if (input.platform === 'web') return analyticsAllowed(input.pathname ?? undefined, input.isKids);
  if (!input.pathname) return false;
  return !input.isKids(input.pathname);
}

/** True when an event's own properties name kids content (second guard besides the route). */
export function propsAreKids(props?: Props): boolean {
  if (!props) return false;
  const q = props.question_id;
  if (typeof q === 'string' && q.startsWith('kf-')) return true;
  return props.category_id === 'kids-family';
}

export function createTracker(deps: {
  getClient: () => AnalyticsClient | null;
  allowed: () => boolean;
  decorate?: (props?: Props) => Props | undefined;
  onEvent?: (event: string, props?: Props) => void;
  onError?: (where: string, e: unknown) => void;
}) {
  return {
    identify(distinctId: string, props?: Props): void {
      if (!deps.allowed()) return;
      try {
        deps.getClient()?.identify(distinctId, props);
      } catch (e) {
        deps.onError?.('identify', e);
      }
    },
    track(event: string, props?: Props): void {
      if (!deps.allowed() || propsAreKids(props)) return;
      const finalProps = deps.decorate ? deps.decorate(props) : props;
      deps.onEvent?.(event, finalProps);
      try {
        deps.getClient()?.capture(event, finalProps);
      } catch (e) {
        deps.onError?.('capture', e);
      }
    },
  };
}
