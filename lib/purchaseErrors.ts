/**
 * Player-facing copy for purchase failures (#159). The paywall must never show a
 * raw SDK or store error: TestFlight build 21 showed RevenueCat's
 * "None of the products ... could be fetched" when the store products did not
 * exist yet. Map by RevenueCat error code (PURCHASES_ERROR_CODE) to short copy;
 * the raw error goes to error tracking only (reportError in the paywall).
 */

/** RevenueCat PURCHASES_ERROR_CODE values this mapping distinguishes. */
const NETWORK = new Set(['10', '35']); // NETWORK_ERROR, OFFLINE_CONNECTION_ERROR
const PAYMENT_PENDING = '20';
const NOT_ALLOWED = '3'; // PURCHASE_NOT_ALLOWED_ERROR (Screen Time, parental settings)
const ALREADY_PURCHASED = '6';

export const PURCHASE_MESSAGES = {
  unavailable: "Purchases aren't available yet. Please try again later. You were not charged.",
  network: "Couldn't reach the store. Check your connection and try again. You were not charged.",
  pending: 'Your purchase is waiting for approval. It will unlock as soon as it is approved.',
  notAllowed: 'Purchases are turned off on this device (for example by Screen Time). You were not charged.',
  alreadyPurchased: 'You already own this. Tap Restore Purchases to unlock it on this device.',
} as const;

function code(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  const c = (e as { code?: unknown }).code;
  return c === undefined || c === null ? null : String(c);
}

/** The message to show for a failed purchase. Never returns the raw error text. */
export function purchaseErrorMessage(e: unknown): string {
  const c = code(e);
  if (c !== null && NETWORK.has(c)) return PURCHASE_MESSAGES.network;
  if (c === PAYMENT_PENDING) return PURCHASE_MESSAGES.pending;
  if (c === NOT_ALLOWED) return PURCHASE_MESSAGES.notAllowed;
  if (c === ALREADY_PURCHASED) return PURCHASE_MESSAGES.alreadyPurchased;
  return PURCHASE_MESSAGES.unavailable;
}
