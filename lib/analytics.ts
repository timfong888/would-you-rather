/**
 * Thin analytics wrapper. The PostHog SDK is ONLY imported here.
 * All UI code calls track() / identify() / buildShareUrl() — never PostHog directly.
 */
import { Platform } from 'react-native';
import { SITE_URL } from '@/constants/config';
import PostHog from 'posthog-react-native';
import { buildShareLink } from '@/lib/shareQuestion';
import { isKidsPath } from '@/lib/kidsPaths';
import { resolveVisitorId, purgeStoredVisitorId, analyticsAllowed } from '@/lib/visitorId';

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

type Props = Record<string, string | number | boolean | null | undefined>;

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

/**
 * True when analytics may run on the page the browser is on. Kids routes (COPPA) never send
 * analytics: no events, no identify. Web only; the native app does not use a web path.
 */
function analyticsOn(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return analyticsAllowed(window.location.pathname, isKidsPath);
}

export function identify(distinctId: string, properties?: Props): void {
  if (!analyticsOn()) return;
  try {
    getClient()?.identify(distinctId, properties as any);
  } catch (e) {
    if (DEBUG) console.warn('[analytics] identify error', e);
  }
}

export function track(event: string, props?: Props): void {
  if (!analyticsOn()) return;
  const finalProps = withGlobalProps(props);
  if (DEBUG) {
    console.log('[analytics]', event, finalProps);
  }
  try {
    getClient()?.capture(event, finalProps as any);
  } catch (e) {
    if (DEBUG) console.warn('[analytics] capture error', e);
  }
}

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
export function buildShareUrl(questionId: string, incomingGeneration: number, kids = false): {
  url: string;
  linkId: string;
} {
  // Kids routes: no link id is generated and none is put in the URL.
  const linkId = kids ? '' : generateLinkId();
  const gen = incomingGeneration + 1;

  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : SITE_URL;

  const url = buildShareLink({ origin, questionId, linkId, generation: gen, kids });
  return { url, linkId };
}
