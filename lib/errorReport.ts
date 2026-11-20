/**
 * Pure helpers for client error tracking (#80): no React Native, no SDK, so they run
 * under plain Node in tests. What reaches analytics is a short, scrubbed description:
 * no stack traces, no URLs with query strings (any scheme, blob:/data: payloads, scheme-less hosts), no email addresses.
 */
// Input is capped before any regex runs, and every pattern below is anchored to a token start (\b) or has no
// leading greedy group, so cost stays linear: a large error payload (a JSON.stringify of an API body, say)
// must not freeze the page, and this runs before the per-page rate limiter.
const MAX_INPUT = 2000;

export function scrub(text: string, max = 200): string {
  return text
    .slice(0, MAX_INPUT)
    // Any scheme:// URL (https, wss, ftp, ...): keep scheme, host (no credentials) and path; drop query and fragment.
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)'"]+/gi, (u) => {
      try {
        const url = new URL(u);
        return `${url.protocol}//${url.host}${url.pathname}`;
      } catch {
        return '<url>';
      }
    })
    // blob: and data: URIs carry a payload or an object ID; drop all of it.
    .replace(/\b(blob|data):[^\s)'"]+/gi, '<$1-uri>')
    // Scheme-less hosts or paths with a query string (www.example.com/p?link_id=x): cut at the "?".
    .replace(/\?[^\s)'"?]*=[^\s)'"]*/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .slice(0, max);
}

export function describeError(err: unknown): { type: string; message: string } {
  if (err instanceof Error) return { type: err.name || 'Error', message: scrub(err.message || String(err)) };
  if (typeof err === 'string') return { type: 'Error', message: scrub(err) };
  try {
    return { type: 'Error', message: scrub(JSON.stringify(err) ?? String(err)) };
  } catch {
    return { type: 'Error', message: 'unknown error' };
  }
}

/**
 * Caps how many error events one page load can send: at most `maxPerKey` of the same
 * error and `maxTotal` overall, so a render loop cannot flood analytics.
 */
export function createLimiter(maxTotal = 10, maxPerKey = 2): (key: string) => boolean {
  let total = 0;
  const seen = new Map<string, number>();
  return (key) => {
    const n = seen.get(key) ?? 0;
    if (total >= maxTotal || n >= maxPerKey) return false;
    seen.set(key, n + 1);
    total++;
    return true;
  };
}
