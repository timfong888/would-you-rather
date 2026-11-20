/**
 * Pure helpers for client error tracking (#80): no React Native, no SDK, so they run
 * under plain Node in tests. What reaches analytics is a short, scrubbed description:
 * no stack traces, no URLs with query strings (any scheme, blob:/data: payloads, scheme-less hosts), no email addresses.
 */
// Input is capped before any regex runs, and every pattern below starts only at a token boundary or has no
// leading greedy group, so cost stays linear: a large error payload (a JSON.stringify of an API body, say)
// must not freeze the page, and this runs before the per-page rate limiter.
const MAX_INPUT = 2000;
const DELIMS = [' ', '\n', '\t', '\r', ',', ';', ')', "'", '"'];

/** Cap the input without cutting a token in half (a half email would no longer match the email pattern). */
function capInput(text: string): string {
  if (text.length <= MAX_INPUT) return text;
  const head = text.slice(0, MAX_INPUT);
  const cut = Math.max(...DELIMS.map((c) => head.lastIndexOf(c)));
  return cut > 0 ? head.slice(0, cut) : head;
}

function cleanUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '<url>';
  }
}

export function scrub(text: string, max = 200): string {
  return capInput(text)
    // Any scheme:// URL (https, wss, ftp, ...), also right after "_" or digits: keep scheme, host (no
    // credentials) and path; drop query and fragment. The capture keeps the character before the scheme.
    .replace(/(^|[^a-z0-9+.-])([a-z0-9][a-z0-9+.-]*:\/\/[^\s)'"]+)/gi, (_m, pre: string, u: string) => pre + cleanUrl(u))
    // blob: and data: URIs carry a payload or an object ID; drop all of it.
    .replace(/(^|[^a-z0-9])(blob|data):[^\s)'"]+/gi, (_m, pre: string, kind: string) => `${pre}<${kind.toLowerCase()}-uri>`)
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
