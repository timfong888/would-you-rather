/**
 * Acquisition attribution (#52). Pure functions: no React, no analytics SDK,
 * no direct browser access (callers pass the referrer, URL and storage in).
 *
 * Channel rules, first match wins:
 *   1 link_id present              -> shared_link
 *   2 known utm_medium             -> social | email | paid | organic_search
 *   3 same-site referrer           -> internal (not an acquisition source)
 *   4 search-engine referrer       -> organic_search
 *   5 social-site referrer         -> social
 *   6 any other outside referrer   -> referral
 *   7 no referrer                  -> direct
 * iMessage and WhatsApp usually send no referrer; those arrivals are caught by rule 1.
 */

export type Channel =
  | 'shared_link'
  | 'social'
  | 'email'
  | 'paid'
  | 'organic_search'
  | 'internal'
  | 'referral'
  | 'direct';

export interface Attribution {
  channel: Channel;
  /** origin + path only: never a query string or hash. */
  referrer?: string;
  referring_domain?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** path only, no query string. */
  landing_path?: string;
}

export interface AttributionInput {
  referrer?: string | null;
  /** Full page URL, e.g. window.location.href. */
  url?: string | null;
  /** Host of this site, to recognise internal referrers. */
  siteHost?: string | null;
}

const SEARCH_HOSTS = [
  /^(.+\.)?google\.[a-z.]+$/,
  /^(.+\.)?bing\.com$/,
  /^(.+\.)?duckduckgo\.com$/,
  /^(.+\.)?yahoo\.com$/,
  /^(.+\.)?ecosia\.org$/,
  /^search\.brave\.com$/,
  /^(.+\.)?baidu\.com$/,
  /^(.+\.)?yandex\.[a-z.]+$/,
  /^(.+\.)?startpage\.com$/,
  /^(.+\.)?qwant\.com$/,
];

const SOCIAL_HOSTS = [
  /^(.+\.)?facebook\.com$/,
  /^(.+\.)?instagram\.com$/,
  /^(x|twitter)\.com$/,
  /^(.+\.)?twitter\.com$/,
  /^t\.co$/,
  /^(.+\.)?tiktok\.com$/,
  /^(.+\.)?reddit\.com$/,
  /^(.+\.)?pinterest\.[a-z.]+$/,
  /^(.+\.)?linkedin\.com$/,
  /^lnkd\.in$/,
  /^(.+\.)?threads\.net$/,
];

const MEDIUM_CHANNEL: Record<string, Channel> = {
  social: 'social',
  email: 'email',
  cpc: 'paid',
  ppc: 'paid',
  paid: 'paid',
  organic: 'organic_search',
};

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');

function parseUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function classifyAttribution(input: AttributionInput): Attribution {
  const page = parseUrl(input.url);
  const ref = parseUrl(input.referrer);
  const params = page?.searchParams;

  const out: Attribution = { channel: 'direct' };
  if (page) out.landing_path = page.pathname;
  if (ref) {
    out.referrer = ref.origin + ref.pathname;
    out.referring_domain = ref.hostname.toLowerCase();
  }
  const utm = (k: string) => params?.get(k)?.trim().slice(0, 100) || undefined;
  out.utm_source = utm('utm_source');
  out.utm_medium = utm('utm_medium');
  out.utm_campaign = utm('utm_campaign');

  const medium = out.utm_medium?.toLowerCase();
  const host = ref ? ref.hostname.toLowerCase() : null;
  const site = input.siteHost ? bare(input.siteHost) : null;

  if (params?.get('link_id')) out.channel = 'shared_link';
  else if (medium && MEDIUM_CHANNEL[medium]) out.channel = MEDIUM_CHANNEL[medium];
  else if (host && site && bare(host) === site) out.channel = 'internal';
  else if (host && SEARCH_HOSTS.some((r) => r.test(host))) out.channel = 'organic_search';
  else if (host && SOCIAL_HOSTS.some((r) => r.test(host))) out.channel = 'social';
  else if (host) out.channel = 'referral';
  else out.channel = 'direct';

  // Drop undefined keys so the result is safe to spread into event properties.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as unknown as Attribution;
}

// ── first touch ─────────────────────────────────────────────────────────────

export const FIRST_TOUCH_KEY = 'wyr_first_touch';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Event properties for the first-ever visit: `first_channel`, `first_utm_*`, … */
export function toFirstTouchProps(a: Attribution): Record<string, string> {
  const map: Record<string, string | undefined> = {
    first_channel: a.channel,
    first_referring_domain: a.referring_domain,
    first_utm_source: a.utm_source,
    first_utm_medium: a.utm_medium,
    first_utm_campaign: a.utm_campaign,
    first_landing_path: a.landing_path,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined)) as Record<string, string>;
}

/**
 * Returns the first visit's attribution, persisting it once. An internal
 * referrer is never stored as a first touch. Storage that is missing or throws
 * (private mode) falls back to this visit's values.
 */
export function getFirstTouch(current: Attribution, storage?: StorageLike | null): Attribution {
  try {
    const raw = storage?.getItem(FIRST_TOUCH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.channel === 'string') return parsed as Attribution;
    }
  } catch {
    return current;
  }
  if (current.channel === 'internal') return current;
  try {
    storage?.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: nothing to persist */
  }
  return current;
}
