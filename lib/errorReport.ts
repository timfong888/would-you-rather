/**
 * Pure helpers for client error tracking (#80): no React Native, no SDK, so they run
 * under plain Node in tests. What reaches analytics is a short, scrubbed description:
 * no stack traces, no URLs with query strings, no email addresses.
 */
export function scrub(text: string, max = 200): string {
  return text
    .replace(/https?:\/\/[^\s)'"]+/gi, (u) => {
      try {
        const url = new URL(u);
        return url.origin + url.pathname;
      } catch {
        return '<url>';
      }
    })
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
