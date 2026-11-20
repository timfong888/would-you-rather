/**
 * Purchases logic with the RevenueCat SDK injected, so it runs under plain
 * Node tests and the native wrapper (purchases.native.ts) stays a thin shell.
 */
import { OFFERING_ID } from './catalog';
import type { PurchasesApi, PurchaseResult } from './purchases.types';

/** The slice of react-native-purchases this module uses. */
export interface SdkCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}
export interface SdkPackage {
  product: { identifier: string; priceString: string };
}
export interface SdkOffering {
  availablePackages: SdkPackage[];
}
export interface SdkLike {
  configure(opts: { apiKey: string }): void;
  getCustomerInfo(): Promise<SdkCustomerInfo>;
  getOfferings(): Promise<{ all: Record<string, SdkOffering>; current: SdkOffering | null }>;
  purchasePackage(pkg: SdkPackage): Promise<{ customerInfo: SdkCustomerInfo }>;
  restorePurchases(): Promise<SdkCustomerInfo>;
  addCustomerInfoUpdateListener(cb: (info: SdkCustomerInfo) => void): void;
  removeCustomerInfoUpdateListener(cb: (info: SdkCustomerInfo) => void): boolean;
}

/** RevenueCat's PURCHASE_CANCELLED_ERROR code. */
const CANCELLED_CODE = '1';

function active(info: SdkCustomerInfo): string[] {
  return Object.keys(info.entitlements.active);
}

function cancelled(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { userCancelled?: boolean | null; code?: unknown };
  return err.userCancelled === true || String(err.code) === CANCELLED_CODE;
}

export function createPurchases(sdk: SdkLike, apiKey: string | undefined): PurchasesApi {
  let configured: Promise<boolean> | null = null;

  const api: PurchasesApi = {
    isAvailable: () => !!apiKey,

    configure() {
      if (!apiKey) return Promise.resolve(false);
      if (!configured) {
        configured = Promise.resolve()
          .then(() => {
            sdk.configure({ apiKey });
            return true;
          })
          .catch((e) => {
            configured = null;
            throw e;
          });
      }
      return configured;
    },

    async getEntitlements() {
      if (!(await api.configure())) return [];
      return active(await sdk.getCustomerInfo());
    },

    onEntitlementsChange(cb) {
      if (!apiKey) return () => {};
      const listener = (info: SdkCustomerInfo) => cb(active(info));
      let removed = false;
      let added = false;
      api
        .configure()
        .then((ok) => {
          if (ok && !removed) {
            sdk.addCustomerInfoUpdateListener(listener);
            added = true;
          }
        })
        .catch(() => {});
      return () => {
        removed = true;
        if (added) sdk.removeCustomerInfoUpdateListener(listener);
      };
    },

    async getPrices() {
      if (!(await api.configure())) return {};
      const offerings = await sdk.getOfferings();
      const offering = offerings.all[OFFERING_ID] ?? offerings.current;
      const out: Record<string, string> = {};
      for (const pkg of offering?.availablePackages ?? []) out[pkg.product.identifier] = pkg.product.priceString;
      return out;
    },

    async purchase(productId): Promise<PurchaseResult> {
      if (!(await api.configure())) throw new Error('Purchases are not available in this build.');
      const offerings = await sdk.getOfferings();
      const offering = offerings.all[OFFERING_ID] ?? offerings.current;
      const pkg = offering?.availablePackages.find((p) => p.product.identifier === productId);
      if (!pkg) throw new Error('This unlock is not available right now. Please try again later.');
      try {
        const { customerInfo } = await sdk.purchasePackage(pkg);
        return { status: 'success', entitlements: active(customerInfo) };
      } catch (e) {
        if (cancelled(e)) return { status: 'cancelled' };
        throw e;
      }
    },

    async restore() {
      if (!(await api.configure())) throw new Error('Purchases are not available in this build.');
      return active(await sdk.restorePurchases());
    },
  };
  return api;
}
