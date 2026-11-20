/**
 * Client error tracking (#80). Sends one `$exception` event per unhandled error or promise
 * rejection through the analytics wrapper, so the kids-route gate, the first-touch
 * properties and the no-key no-op all apply. Properties: type, message (scrubbed, 200 chars),
 * path (no query string), source. No stack traces.
 */
import { Platform } from 'react-native';
import { track, analyticsOn } from '@/lib/analytics';
import { describeError, createLimiter } from '@/lib/errorReport';

let installed = false;
let allow = createLimiter();

function currentPath(): string | undefined {
  return typeof window !== 'undefined' ? window.location.pathname : undefined;
}

export function reportError(err: unknown, source: 'window.onerror' | 'unhandledrejection' | 'render' | 'manual'): void {
  try {
    // Errors that cannot be sent (kids routes, native before the route is known) must not use up the
    // per-page budget, or a burst on a kids page would silence later errors on adult pages.
    if (!analyticsOn()) return;
    const { type, message } = describeError(err);
    if (!allow(`${type}:${message}`)) return;
    track('$exception', {
      $exception_type: type,
      $exception_message: message,
      $exception_source: source,
      $exception_list: JSON.stringify([{ type, value: message, mechanism: { handled: source === 'manual', type: source } }]),
      path: currentPath(),
    });
  } catch {
    /* error reporting must never throw */
  }
}

/** Call once on the web. Safe to call again. */
export function installErrorTracking(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window.onerror'));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'));
}

/** Test hook. */
export function __resetErrorTrackingForTests(): void {
  installed = false;
  allow = createLimiter();
}
