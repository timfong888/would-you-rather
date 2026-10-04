/**
 * Owner access — lets the app owner (and testers) use every paid feature
 * without going through the payment flow.
 *
 * How it stays safe without a backend:
 *   - The plaintext access code is never shipped. Only its SHA-256 digest is
 *     baked into the bundle via EXPO_PUBLIC_OWNER_ACCESS_SHA256.
 *   - If that env var is not set, owner access is disabled entirely — there is
 *     no default code.
 *   - Comparison is against the digest, so reading the JS bundle does not
 *     reveal the code. Use a long random passphrase (see
 *     scripts/owner-code-hash.mjs) so brute force is not feasible.
 *
 * Honest limitation: unlock state lives in localStorage on web, so a
 * determined user with devtools can still flip the flag — exactly as they can
 * for purchased unlocks today. Real enforcement arrives with server-side
 * entitlements (RevenueCat, SAT-926). Owner access is about keeping the code
 * secret and keeping tester activity out of the paywall metrics, not about
 * DRM.
 */
import { Platform } from 'react-native';

export const OWNER_ACCESS_STORAGE_KEY = 'wyr_owner_access';

const OWNER_ACCESS_SHA256 = (process.env.EXPO_PUBLIC_OWNER_ACCESS_SHA256 ?? '')
  .trim()
  .toLowerCase();

/** True when the build has an owner-access hash configured. */
export function isOwnerAccessConfigured(): boolean {
  return /^[0-9a-f]{64}$/.test(OWNER_ACCESS_SHA256);
}

async function sha256Hex(input: string): Promise<string | null> {
  const subtle =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;
  if (!subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify an access code against the configured digest.
 * Resolves false when owner access is not configured or crypto is unavailable.
 */
export async function verifyOwnerAccessCode(code: string): Promise<boolean> {
  if (!isOwnerAccessConfigured()) return false;
  const normalized = code.trim();
  if (!normalized) return false;
  const digest = await sha256Hex(normalized);
  return digest !== null && digest === OWNER_ACCESS_SHA256;
}

// Persistence is web-only on purpose, matching every other store in the app
// (purchased unlocks in UnlockedContext, answered questions, visitor id all
// use localStorage behind the same Platform.OS === 'web' guard). The product
// is web-first (SAT-630); when the EAS/native build lands, owner access
// should move to a RevenueCat granted entitlement rather than a second
// local store (see docs/owner-access.md). Until then, on native the grant
// lasts for the session only.
export function loadOwnerAccess(): boolean {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(OWNER_ACCESS_STORAGE_KEY) === 'granted';
    } catch {}
  }
  return false;
}

export function saveOwnerAccess(granted: boolean): void {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      if (granted) localStorage.setItem(OWNER_ACCESS_STORAGE_KEY, 'granted');
      else localStorage.removeItem(OWNER_ACCESS_STORAGE_KEY);
    } catch {}
  }
}
