/**
 * Web / default implementation: purchases are unavailable.
 *
 * Metro picks lib/purchases.native.ts on iOS and Android and this file
 * everywhere else, so the web bundle never imports react-native-purchases.
 * Web payments are a separate decision (issue #53); until then the web paywall
 * keeps its existing behavior.
 */
import type { PurchasesApi } from './purchases.types';

export type { PurchasesApi, PurchaseResult } from './purchases.types';

const unavailable = (): Error => new Error('Purchases are not available on this platform.');

export const purchases: PurchasesApi = {
  isAvailable: () => false,
  configure: async () => false,
  getEntitlements: async () => [],
  onEntitlementsChange: () => () => {},
  getPrices: async () => ({}),
  purchase: async () => {
    throw unavailable();
  },
  restore: async () => {
    throw unavailable();
  },
};
