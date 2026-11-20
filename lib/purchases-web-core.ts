/**
 * Web purchases through RevenueCat Web Billing (Stripe), with the
 * @revenuecat/purchases-js SDK injected so this runs under plain Node tests.
 * lib/purchases.ts binds the real SDK.
 *
 * Keys (public, safe in the client):
 *   rcb_sb_...  Web Billing sandbox: Stripe test mode, card 4242 4242 4242 4242
 *   rcb_...     Web Billing live: real charges, production only
 * A key on the wrong deploy (sandbox on production, live on preview/local) is
 * refused here and fails the build (scripts/check-web-build.mjs).
 *
 * Identity: Web Billing needs an app user id. No id is created until the
 * visitor starts a purchase (after the parental gate on kids routes), so
 * browsing, including every kids route, sends no identifier to RevenueCat.
 * The id lives in this browser's storage; entitlements are read for it on
 * launch. A visitor who never started a purchase has no id and no entitlements.
 */
import { OFFERING_ID } from './catalog';
import type { PurchasesApi, PurchaseResult } from './purchases.types';
import { parseDeployEnv } from './testUnlockPolicy';

/** The slice of @revenuecat/purchases-js this module uses. */
export interface WebCustomerInfo {
  entitlements: { active: Record<string, unknown> };
}
export interface WebPackage {
  webBillingProduct: { identifier: string; currentPrice: { formattedPrice: string } };
}
export interface WebOffering {
  availablePackages: WebPackage[];
}
export interface WebPurchasesInstance {
  getCustomerInfo(): Promise<WebCustomerInfo>;
  getOfferings(): Promise<{ all: Record<string, WebOffering>; current: WebOffering | null }>;
  purchase(params: { rcPackage: WebPackage }): Promise<{ customerInfo: WebCustomerInfo }>;
}
export interface WebSdkModule {
  configure(config: { apiKey: string; appUserId: string }): WebPurchasesInstance;
  generateRevenueCatAnonymousAppUserId(): string;
}
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const WEB_USER_STORAGE_KEY = 'wyr_rc_web_user';

/** purchases-js ErrorCode.UserCancelledError. */
const CANCELLED_CODE = 1;

function active(info: WebCustomerInfo): string[] {
  return Object.keys(info.entitlements.active);
}

function cancelled(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  return (e as { errorCode?: unknown }).errorCode === CANCELLED_CODE;
}

/**
 * True when this key may be used on this deploy. Sandbox keys (rcb_sb_) only
 * on preview/development; live keys (rcb_) only on production, so a preview
 * or local build can never take a real charge. Anything else is refused.
 */
export function webKeyUsable(apiKey: string | undefined, deployEnvRaw: string | undefined): boolean {
  if (!apiKey || !apiKey.startsWith('rcb_')) return false;
  const sandbox = apiKey.startsWith('rcb_sb_');
  const production = parseDeployEnv(deployEnvRaw) === 'production';
  return sandbox ? !production : production;
}

export interface WebPurchasesDeps {
  apiKey: string | undefined;
  deployEnv: string | undefined;
  loadSdk: () => Promise<WebSdkModule>;
  store: KeyValueStore;
}

export function createWebPurchases({ apiKey, deployEnv, loadSdk, store }: WebPurchasesDeps): PurchasesApi {
  const usable = webKeyUsable(apiKey, deployEnv);
  let instance: Promise<WebPurchasesInstance> | null = null;

  /** Configures the SDK for the stored user. With create=false and no stored user, resolves null. */
  function getInstance(create: boolean): Promise<WebPurchasesInstance | null> {
    if (!usable) return Promise.resolve(null);
    if (instance) return instance;
    let userId = store.get(WEB_USER_STORAGE_KEY);
    if (!userId && !create) return Promise.resolve(null);
    instance = loadSdk()
      .then((sdk) => {
        if (!userId) {
          userId = sdk.generateRevenueCatAnonymousAppUserId();
          store.set(WEB_USER_STORAGE_KEY, userId);
        }
        return sdk.configure({ apiKey: apiKey as string, appUserId: userId });
      })
      .catch((e) => {
        instance = null;
        throw e;
      });
    return instance;
  }

  async function findPackage(p: WebPurchasesInstance, productId: string): Promise<WebPackage | undefined> {
    const offerings = await p.getOfferings();
    const offering = offerings.all[OFFERING_ID] ?? offerings.current;
    return offering?.availablePackages.find((pkg) => pkg.webBillingProduct.identifier === productId);
  }

  const api: PurchasesApi = {
    isAvailable: () => usable,

    async configure() {
      return (await getInstance(false)) !== null;
    },

    async getEntitlements() {
      const p = await getInstance(false);
      return p ? active(await p.getCustomerInfo()) : [];
    },

    // Web Billing has no push listener; the context refreshes on focus instead.
    onEntitlementsChange: () => () => {},

    async getPrices() {
      // Prices need a configured SDK, which needs a user id. Until the visitor
      // starts a purchase the paywall shows the approved fallback prices; the
      // Web Billing checkout shows the real price before any charge.
      const p = await getInstance(false);
      if (!p) return {};
      const offerings = await p.getOfferings();
      const offering = offerings.all[OFFERING_ID] ?? offerings.current;
      const out: Record<string, string> = {};
      for (const pkg of offering?.availablePackages ?? []) {
        out[pkg.webBillingProduct.identifier] = pkg.webBillingProduct.currentPrice.formattedPrice;
      }
      return out;
    },

    async purchase(productId): Promise<PurchaseResult> {
      const p = await getInstance(true);
      if (!p) throw new Error('Purchases are not available right now.');
      const pkg = await findPackage(p, productId);
      if (!pkg) throw new Error('This unlock is not available right now. Please try again later.');
      try {
        const { customerInfo } = await p.purchase({ rcPackage: pkg });
        return { status: 'success', entitlements: active(customerInfo) };
      } catch (e) {
        if (cancelled(e)) return { status: 'cancelled' };
        throw e;
      }
    },

    async restore() {
      // Web purchases belong to the id stored in this browser. Without one
      // there is nothing to restore (and no id is created just to look).
      if (!usable) throw new Error('Purchases are not available right now.');
      const p = await getInstance(false);
      return p ? active(await p.getCustomerInfo()) : [];
    },
  };
  return api;
}
