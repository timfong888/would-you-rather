/**
 * Thin analytics wrapper. The PostHog SDK is ONLY imported here.
 * All UI code calls track() / identify() / buildShareUrl() — never PostHog directly.
 */
import { Platform } from 'react-native';
import { SITE_URL } from '@/constants/config';
import PostHog from 'posthog-react-native';
import { buildShareLink } from '@/lib/shareQuestion';
import { isKidsPath } from '@/lib/kidsPaths';
import { resolveVisitorId, purgeStoredVisitorId } from '@/lib/visitorId';
import { analyticsOnFor, createTracker, type Props } from '@/lib/analyticsCore';

export const DEBUG = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_DEBUG_KEY = process.env.EXPO_PUBLIC_POSTHOG_DEBUG_KEY ?? '';

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (_client) return _client;
  if (typeof window === 'undefined') return null; // SSR guard

  const key = DEBUG && POSTHOG_DEBUG_KEY ? POSTHOG_DEBUG_KEY : POSTHOG_KEY;
  if (!key) {
    if (DEBUG) console.log('[analytics] No PostHog key — events logged to console only');
    return null;
  }
  _client = new PostHog(key, {
    host: 'https://us.i.posthog.com',
    captureAppLifecycleEvents: false,
  });
  return _client;
}

// ── owner access flag ───────────────────────────────────────────────────────
// Set by UnlockedProvider. While true, every event carries owner_access: true
// so the owner's / testers' activity can be filtered out of paywall funnels.
let _ownerAccess = false;

export function setOwnerAccessFlag(active: boolean): void {
  _ownerAccess = active;
}

function withGlobalProps(props?: Props): Props | undefined {
  if (!_ownerAccess) return props;
  return { ...(props ?? {}), owner_access: true };
}

// Native has no window.location: the router path is pushed here by AnalyticsProvider, on every
// render and before any child effect runs. Null means "not known yet", and analytics stays off.
let _nativePath: string | null = null;

export function setCurrentRoute(pathname: string | null | undefined): void {
  _nativePath = pathname || null;
}

/**
 * True when analytics may run on the current screen. Kids routes (COPPA) never send analytics:
 * no events, no identify, on web and on native alike. Native is closed until the route is known.
 */
function analyticsOn(): boolean {
  const pathname =
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? window.location.pathname
        : undefined
      : _nativePath;
  if (Platform.OS === 'web' && typeof window === 'undefined') return true; // SSR: no client anyway
  return analyticsOnFor({ platform: Platform.OS, pathname, isKids: isKidsPath });
}

const tracker = createTracker({
  getClient: () => getClient() as any,
  allowed: analyticsOn,
  decorate: withGlobalProps,
  onEvent: (event, props) => {
    if (DEBUG) console.log('[analytics]', event, props);
  },
  onError: (where, e) => {
    if (DEBUG) console.warn(`[analytics] ${where} error`, e);
  },
});

export const identify = tracker.identify;
export const track = tracker.track;

// ── visitor_id ──────────────────────────────────────────────────────────────

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const _memoryVisitor: { id?: string } = {};

/**
 * Returns the persisted visitor ID, creating one on first call. On kids routes nothing is read
 * or stored (an existing ID is removed) and an in-memory ID is used instead.
 */
export function getOrCreateVisitorId(): { id: string; isNew: boolean } {
  if (Platform.OS !== 'web') {
    return { id: uuid(), isNew: true };
  }
  const onKids = typeof window !== 'undefined' && isKidsPath(window.location.pathname);
  let storage: Storage | null = null;
  try {
    storage = typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    storage = null;
  }
  return resolveVisitorId({ kids: onKids, storage, uuid, memory: _memoryVisitor });
}

/** Remove the persisted visitor ID (called when a kids route is shown). */
export function purgeVisitorId(): void {
  if (Platform.OS !== 'web') return;
  try {
    purgeStoredVisitorId(typeof localStorage !== 'undefined' ? localStorage : null);
  } catch {
    /* storage unavailable */
  }
}

// ── link_id / share URL construction ────────────────────────────────────────

export function generateLinkId(): string {
  return uuid();
}

/**
 * Build a share URL for a question that carries link_id and generation.
 * `incomingGeneration` is the generation the current session arrived with;
 * the new link's generation is incomingGeneration + 1.
 */
export function buildShareUrl(
  questionId: string,
  incomingGeneration: number,
  kids = false,
  friendPick: 'A' | 'B' | 'ask' | null = null,
): {
  url: string;
  linkId: string;
} {
  // Kids routes: no link id is generated and none is put in the URL.
  const linkId = kids ? '' : generateLinkId();
  const gen = incomingGeneration + 1;

  // SITE_URL is the canonical origin unless a non-production build sets EXPO_PUBLIC_SITE_URL
  // (local browserless runs, previews). Native builds set nothing, so they share real-domain links,
  // and the share pages (generate-sharing-pages.mjs) use the same value, so links and pages agree.
  const url = buildShareLink({ origin: SITE_URL, questionId, linkId, generation: gen, kids, friendPick });
  return { url, linkId };
}
