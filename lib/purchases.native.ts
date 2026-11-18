/**
 * iOS / Android implementation on top of react-native-purchases.
 *
 * Key per stage (public SDK keys, safe in the client):
 *   development  EXPO_PUBLIC_RC_IOS_KEY=test_...   RevenueCat Test Store
 *   preview      EXPO_PUBLIC_RC_IOS_KEY=appl_...   App Store sandbox
 *   production   EXPO_PUBLIC_RC_IOS_KEY=appl_...   real purchases
 * The code is identical in every stage; only the key changes.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { CustomerInfo, PurchasesError } from 'react-native-purchases';
import { OFFERING_ID } from './catalog';
import type { PurchasesApi, PurchaseResult } from './purchases.types';

export type { PurchasesApi, PurchaseResult } from './purchases.types';

const API_KEY =
  Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

let configurePromise: Promise<boolean> | null = null;

function activeEntitlements(info: CustomerInfo): string[] {
  return Object.keys(info.entitlements.active);
}

function isPurchasesError(e: unknown): e is PurchasesError {
  return typeof e === 'object' && e !== null && 'code' in e;
}

export const purchases: PurchasesApi = {
  isAvailable: () => !!API_KEY,

  configure() {
    if (!API_KEY) return Promise.resolve(false);
    if (!configurePromise) {
      configurePromise = (async () => {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: API_KEY });
        return true;
      })().catch((e) => {
        configurePromise = null;
        throw e;
      });
    }
    return configurePromise;
  },

  async getEntitlements() {
    if (!(await purchases.configure())) return [];
    return activeEntitlements(await Purchases.getCustomerInfo());
  },

  onEntitlementsChange(cb) {
    if (!API_KEY) return () => {};
    const listener = (info: CustomerInfo) => cb(activeEntitlements(info));
    // The listener must be registered after configure(); register it lazily.
    let removed = false;
    purchases.configure().then((ok) => {
      if (ok && !removed) Purchases.addCustomerInfoUpdateListener(listener);
    });
    return () => {
      removed = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  },

  async getPrices() {
    if (!(await purchases.configure())) return {};
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all[OFFERING_ID] ?? offerings.current;
    const out: Record<string, string> = {};
    for (const pkg of offering?.availablePackages ?? []) {
      out[pkg.product.identifier] = pkg.product.priceString;
    }
    return out;
  },

  async purchase(productId): Promise<PurchaseResult> {
    if (!(await purchases.configure())) throw new Error('Purchases are not available in this build.');
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all[OFFERING_ID] ?? offerings.current;
    const pkg = offering?.availablePackages.find((p) => p.product.identifier === productId);
    if (!pkg) throw new Error('This unlock is not available right now. Please try again later.');
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return { status: 'success', entitlements: activeEntitlements(customerInfo) };
    } catch (e) {
      if (isPurchasesError(e) && (e.userCancelled || e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)) {
        return { status: 'cancelled' };
      }
      throw e;
    }
  },

  async restore() {
    if (!(await purchases.configure())) throw new Error('Purchases are not available in this build.');
    return activeEntitlements(await Purchases.restorePurchases());
  },
};
