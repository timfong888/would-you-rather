/**
 * Thin analytics wrapper. The PostHog SDK is ONLY imported here.
 * All UI code calls track() / identify() / buildShareUrl() — never PostHog directly.
 */
import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';

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

export function identify(distinctId: string, properties?: Props): void {
  getClient()?.identify(distinctId, properties as any);
}

export function track(event: string, props?: Props): void {
  if (DEBUG) {
    console.log('[analytics]', event, props);
  }
  try {
    getClient()?.capture(event, props as any);
  } catch (e) {
    if (DEBUG) console.warn('[analytics] capture error', e);
  }
}

// ── visitor_id ──────────────────────────────────────────────────────────────

const VISITOR_KEY = 'wyr_visitor_id';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Returns the persisted visitor ID, creating one on first call. */
export function getOrCreateVisitorId(): { id: string; isNew: boolean } {
  if (Platform.OS !== 'web') {
    return { id: uuid(), isNew: true };
  }
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return { id: existing, isNew: false };
    const id = uuid();
    localStorage.setItem(VISITOR_KEY, id);
    return { id, isNew: true };
  } catch {
    return { id: uuid(), isNew: true };
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
export function buildShareUrl(questionId: string, incomingGeneration: number): {
  url: string;
  linkId: string;
} {
  const linkId = generateLinkId();
  const gen = incomingGeneration + 1;

  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://wouldyourather.vercel.app';

  const url = `${origin}/p/${questionId}?link_id=${linkId}&gen=${gen}`;
  return { url, linkId };
}
