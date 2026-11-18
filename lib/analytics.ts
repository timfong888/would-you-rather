/**
 * Thin analytics wrapper. The PostHog SDK is ONLY imported here.
 * All UI code calls track() / identify() / buildShareUrl() — never PostHog directly.
 */
import { Platform } from 'react-native';
import { SITE_URL } from '@/constants/config';
import PostHog from 'posthog-react-native';
import { isKidsPath } from '@/lib/kidsPaths';
import { classifyAttribution, getFirstTouch, toFirstTouchProps, type Attribution } from '@/lib/attribution';
import {
  ACTIVATION_KEY,
  parseActivationState,
  recordActivationVote,
} from '@/lib/activation';

export const DEBUG = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true';

// PostHog project token for the WYR production project. It is a public, client-side
// token (it ships in the bundle by design), so it is committed as the default. It is
// used only on the production host, so previews and local runs never write to the
// production project; EXPO_PUBLIC_POSTHOG_KEY overrides it in any environment.
const PRODUCTION_HOST = 'www.wouldyourather.fyi';
const PRODUCTION_POSTHOG_KEY = 'phc_tgCnvAs7acL2qt4ht55R6xmq2yVjqoiv5NFxUvDGCGoM';
const POSTHOG_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  (typeof window !== 'undefined' && window.location.hostname === PRODUCTION_HOST
    ? PRODUCTION_POSTHOG_KEY
    : '');
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

// Kids pages (COPPA, #65: anonymous votes only): nothing is sent to PostHog while the
// visitor is on a kids-bank page (lib/kidsPaths.ts). Console debug still logs.
function onKidsPage(): boolean {
  return typeof window !== 'undefined' && isKidsPath(window.location.pathname);
}

// ── owner access flag ───────────────────────────────────────────────────────
// Set by UnlockedProvider. While true, every event carries owner_access: true
// so the owner's / testers' activity can be filtered out of paywall funnels.
let _ownerAccess = false;

export function setOwnerAccessFlag(active: boolean): void {
  _ownerAccess = active;
}

// Properties sent with every event: `platform`, plus the first-touch attribution
// (`first_channel`, `first_utm_*`, …) once the session has registered it (#52).
let _superProps: Props = { platform: Platform.OS === 'web' ? 'web' : Platform.OS };

export function registerSuperProps(props: Props): void {
  _superProps = { ..._superProps, ...props };
}

function withGlobalProps(props?: Props): Props {
  const merged: Props = { ..._superProps, ...(props ?? {}) };
  if (_ownerAccess) merged.owner_access = true;
  return merged;
}

export function identify(distinctId: string, properties?: Props): void {
  if (onKidsPage()) return;
  try {
    getClient()?.identify(distinctId, properties as any);
  } catch (e) {
    if (DEBUG) console.warn('[analytics] identify error', e);
  }
}

export function track(event: string, props?: Props): void {
  const finalProps = withGlobalProps(props);
  if (DEBUG) {
    console.log('[analytics]', event, finalProps);
  }
  if (onKidsPage()) return;
  try {
    getClient()?.capture(event, finalProps as any);
  } catch (e) {
    if (DEBUG) console.warn('[analytics] capture error', e);
  }
}

// ── activation ──────────────────────────────────────────────────────────────

const FIRST_SESSION_KEY = 'wyr_first_session';

/** Call once per page load when the visitor id was just created. Per-tab (sessionStorage). */
export function markFirstSession(): void {
  try {
    if (Platform.OS === 'web') sessionStorage.setItem(FIRST_SESSION_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

/**
 * Counts a vote toward activation and fires `activated` once, on the vote that
 * reaches the threshold inside the visitor's first session. Safe without storage.
 */
export function trackVoteForActivation(props?: Props): void {
  if (Platform.OS !== 'web') return;
  try {
    const first = sessionStorage.getItem(FIRST_SESSION_KEY) === '1';
    const prev = parseActivationState(localStorage.getItem(ACTIVATION_KEY));
    const { state, fire } = recordActivationVote(prev, first);
    localStorage.setItem(ACTIVATION_KEY, JSON.stringify(state));
    if (fire) track('activated', { votes: state.votes, ...(props ?? {}) });
  } catch {
    /* storage unavailable: skip rather than fire repeatedly */
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
      : SITE_URL;

  const url = `${origin}/p/${questionId}?link_id=${linkId}&gen=${gen}`;
  return { url, linkId };
}

// ── session init ────────────────────────────────────────────────────────────

export interface SessionInfo {
  visitorId: string;
  isNew: boolean;
  attribution: Attribution;
  linkId: string | null;
  generation: number;
}

let _session: SessionInfo | null = null;

/**
 * Initialises the visitor, first-session flag, identity and first-touch super
 * properties exactly once per page load. AnalyticsProvider calls it while rendering,
 * i.e. before any child effect (route page_view, vote-retry flush) can create the
 * visitor id or capture an event. Returns null where there is no window to read
 * (static export render); that case is not memoised.
 */
export function ensureSessionInit(): SessionInfo | null {
  if (_session) return _session;
  const isWeb = Platform.OS === 'web';
  if (isWeb && typeof window === 'undefined') return null;

  const { id: visitorId, isNew } = getOrCreateVisitorId();
  if (isNew) markFirstSession();
  identify(visitorId);

  let attribution = classifyAttribution({});
  let linkId: string | null = null;
  let generation = 0;
  if (isWeb) {
    attribution = classifyAttribution({
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      url: window.location.href,
      siteHost: window.location.host,
    });
    const params = new URLSearchParams(window.location.search);
    linkId = params.get('link_id');
    generation = parseInt(params.get('gen') ?? '0', 10) || 0;
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { storage = null; }
    registerSuperProps(toFirstTouchProps(getFirstTouch(attribution, storage)));
  }
  _session = { visitorId, isNew, attribution, linkId, generation };
  return _session;
}
