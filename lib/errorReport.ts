/**
 * Pure helpers for client error tracking (#80): no React Native, no SDK, so they run
 * under plain Node in tests. What reaches analytics is a short, scrubbed description:
 * no stack traces, no URLs with query strings (any scheme, blob:/data: payloads, scheme-less hosts), no email addresses.
 */
// Every pattern below starts only at a token boundary or has no leading greedy group, so scrub is linear in
// the input. This cap is only a sanity limit for huge payloads (a JSON.stringify of an API body, say); it runs
// before the per-page rate limiter and must not freeze the page. It cuts only at characters that every pattern
// below treats as a token terminator (whitespace, ")", quotes), so no URL or email is ever split in half; text
// of that size with no such character is replaced by a marker instead of being cut mid-token.
const MAX_INPUT = 100_000;
const TERMINATOR = /[\s)'"]/;

function capInput(text: string): string {
  if (text.length <= MAX_INPUT) return text;
  for (let i = MAX_INPUT - 1; i > 0; i--) {
    if (TERMINATOR.test(text[i])) return text.slice(0, i);
  }
  return '<truncated>';
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
    // Starts only at the beginning of a [\w.+-] run, so a long run without "@" is scanned once, not once per character.
    .replace(/(^|[^\w.+-])[\w.+-]+@[\w-]+\.[\w.-]+/g, '$1<email>')
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
