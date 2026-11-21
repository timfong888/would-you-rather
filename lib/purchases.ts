/**
 * Web implementation: RevenueCat Web Billing (Stripe) via @revenuecat/purchases-js.
 *
 * Metro picks lib/purchases.native.ts on iOS and Android and this file
 * everywhere else, so native bundles never contain the web SDK and the web
 * bundle never contains react-native-purchases. The logic is in
 * purchases-web-core.ts (unit-tested); this file binds the SDK, the key and
 * browser storage.
 *
 * Key per Vercel environment (EXPO_PUBLIC_RC_WEB_KEY, public):
 *   Preview / local   test_...    RevenueCat Test Store, never charges (default)
 *                     rcb_sb_...  or Web Billing sandbox, Stripe test mode
 *   Production        rcb_...     live
 * Without a key, purchases are unavailable and the paywall says so.
 */
import { createWebPurchases } from './purchases-web-core';
import type { KeyValueStore, WebSdkModule } from './purchases-web-core';

export type { PurchasesApi, PurchaseResult } from './purchases.types';

const store: KeyValueStore = {
  get(key) {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch {}
  },
};

// Loaded on first use (a purchase, or a returning buyer's entitlement check),
// so the SDK and Stripe are not fetched for visitors who never buy.
const loadSdk = (): Promise<WebSdkModule> =>
  import('@revenuecat/purchases-js').then(({ Purchases }) => ({
    configure: (config) => Purchases.configure(config),
    generateRevenueCatAnonymousAppUserId: () => Purchases.generateRevenueCatAnonymousAppUserId(),
  }));

export const purchases = createWebPurchases({
  apiKey: process.env.EXPO_PUBLIC_RC_WEB_KEY,
  deployEnv: process.env.EXPO_PUBLIC_DEPLOY_ENV,
  loadSdk,
  store,
});
