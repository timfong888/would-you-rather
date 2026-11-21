/**
 * Navigate once the root navigator is mounted.
 *
 * On a cold web load the exported page is rendered fresh, not hydrated
 * (scripts/web-export-compat.mjs), so a screen's effects can run before
 * expo-router's root navigator is mounted, even though
 * useRootNavigationState() already has a key. router.replace() then throws
 * "Attempted to navigate before mounting the Root Layout component", and an
 * error thrown in an effect unmounts the whole tree: a blank page (verifier,
 * PR #128). This retries until the navigator accepts the call.
 *
 * Returns a cancel function for effect cleanup. Any other error, or running
 * out of tries, is logged instead of thrown, so a navigation problem leaves
 * the screen's own fallback (e.g. the locked card) on screen, never a blank page.
 */
export interface Replacer {
  replace(href: string): void;
}

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultScheduler: Scheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function isNotMountedError(e: unknown): boolean {
  return e instanceof Error && /before mounting the Root Layout/i.test(e.message);
}

export function replaceWhenReady(
  router: Replacer,
  href: string,
  { delayMs = 50, maxTries = 100, scheduler = defaultScheduler }: { delayMs?: number; maxTries?: number; scheduler?: Scheduler } = {},
): () => void {
  let cancelled = false;
  let handle: unknown = null;
  let tries = 0;
  const attempt = () => {
    handle = null;
    if (cancelled) return;
    tries++;
    try {
      router.replace(href);
    } catch (e) {
      if (isNotMountedError(e) && tries < maxTries) {
        handle = scheduler.setTimeout(attempt, delayMs);
        return;
      }
      console.error(`Navigation to ${href} failed`, e);
    }
  };
  attempt();
  return () => {
    cancelled = true;
    if (handle !== null) scheduler.clearTimeout(handle);
  };
}
