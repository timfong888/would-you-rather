/** Contract shared by lib/purchases.ts (web stub) and lib/purchases.native.ts. */

export type PurchaseResult =
  | { status: 'success'; entitlements: string[] }
  | { status: 'cancelled' };

export interface PurchasesApi {
  /** False on web and when no RevenueCat key is configured for this build. */
  isAvailable(): boolean;
  /** Safe to call more than once. Resolves false when purchases are unavailable. */
  configure(): Promise<boolean>;
  /** Ids of the entitlements that are active right now. */
  getEntitlements(): Promise<string[]>;
  /** Called whenever RevenueCat reports new customer info (purchase, refund, expiry). */
  onEntitlementsChange(cb: (active: string[]) => void): () => void;
  /** Localized store price strings keyed by store product id, e.g. { wyr_premium_all: '$4.99' }. */
  getPrices(): Promise<Record<string, string>>;
  /** Buys one product. A user cancel resolves { status: 'cancelled' }; other failures throw. */
  purchase(productId: string): Promise<PurchaseResult>;
  /** Restores purchases made with this store account and returns active entitlement ids. */
  restore(): Promise<string[]>;
}
