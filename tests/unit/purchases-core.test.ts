import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPurchases } from '../../lib/purchases-core';
import type { SdkLike, SdkCustomerInfo, SdkPackage } from '../../lib/purchases-core';

const info = (...ids: string[]): SdkCustomerInfo => ({
  entitlements: { active: Object.fromEntries(ids.map((i) => [i, {}])) },
});
const pkg = (id: string, price: string): SdkPackage => ({ product: { identifier: id, priceString: price } });

function fakeSdk(overrides: Partial<SdkLike> = {}) {
  const calls = { configure: 0, added: 0, removed: 0 };
  const sdk: SdkLike = {
    configure: () => {
      calls.configure++;
    },
    getCustomerInfo: async () => info('cat_high-life'),
    getOfferings: async () => ({
      all: { default: { availablePackages: [pkg('wyr_premium_all', '$4.99'), pkg('wyr_unlock_high_life', '$1.99')] } },
      current: null,
    }),
    purchasePackage: async () => ({ customerInfo: info('premium_all') }),
    restorePurchases: async () => info('cat_high-life'),
    addCustomerInfoUpdateListener: () => {
      calls.added++;
    },
    removeCustomerInfoUpdateListener: () => {
      calls.removed++;
      return true;
    },
    ...overrides,
  };
  return { sdk, calls };
}

test('without a key purchases are unavailable and the SDK is never touched', async () => {
  const { sdk, calls } = fakeSdk();
  const p = createPurchases(sdk, undefined);
  assert.equal(p.isAvailable(), false);
  assert.equal(await p.configure(), false);
  assert.deepEqual(await p.getEntitlements(), []);
  assert.deepEqual(await p.getPrices(), {});
  await assert.rejects(p.purchase('wyr_premium_all'));
  await assert.rejects(p.restore());
  assert.equal(calls.configure, 0);
});

test('configure runs once however many calls', async () => {
  const { sdk, calls } = fakeSdk();
  const p = createPurchases(sdk, 'test_key');
  await Promise.all([p.configure(), p.configure(), p.getEntitlements()]);
  assert.equal(calls.configure, 1);
});

test('getEntitlements and getPrices read the default offering', async () => {
  const p = createPurchases(fakeSdk().sdk, 'test_key');
  assert.deepEqual(await p.getEntitlements(), ['cat_high-life']);
  assert.deepEqual(await p.getPrices(), { wyr_premium_all: '$4.99', wyr_unlock_high_life: '$1.99' });
});

test('purchase buys the package for the requested product and returns active entitlements', async () => {
  let bought = '';
  const { sdk } = fakeSdk({
    purchasePackage: async (pk) => {
      bought = pk.product.identifier;
      return { customerInfo: info('premium_all') };
    },
  });
  const r = await createPurchases(sdk, 'k').purchase('wyr_premium_all');
  assert.equal(bought, 'wyr_premium_all');
  assert.deepEqual(r, { status: 'success', entitlements: ['premium_all'] });
});

test('purchase of a product missing from the offering throws a readable error', async () => {
  const p = createPurchases(fakeSdk().sdk, 'k');
  await assert.rejects(p.purchase('wyr_unlock_nope'), /not available/);
});

test('user cancel is quiet; any other error is thrown', async () => {
  const cancelSdk = fakeSdk({
    purchasePackage: async () => {
      throw Object.assign(new Error('cancelled'), { userCancelled: true, code: '1' });
    },
  }).sdk;
  assert.deepEqual(await createPurchases(cancelSdk, 'k').purchase('wyr_premium_all'), { status: 'cancelled' });

  const codeOnly = fakeSdk({
    purchasePackage: async () => {
      throw Object.assign(new Error('cancelled'), { code: '1' });
    },
  }).sdk;
  assert.deepEqual(await createPurchases(codeOnly, 'k').purchase('wyr_premium_all'), { status: 'cancelled' });

  const failSdk = fakeSdk({
    purchasePackage: async () => {
      throw Object.assign(new Error('store down'), { code: '2' });
    },
  }).sdk;
  await assert.rejects(createPurchases(failSdk, 'k').purchase('wyr_premium_all'), /store down/);
});

test('restore returns the active entitlements', async () => {
  assert.deepEqual(await createPurchases(fakeSdk().sdk, 'k').restore(), ['cat_high-life']);
});

test('listener: registered after configure, delivers entitlements, removed on cleanup', async () => {
  let registered: ((i: SdkCustomerInfo) => void) | undefined;
  const { sdk, calls } = fakeSdk({
    addCustomerInfoUpdateListener: (cb) => {
      registered = cb;
    },
  });
  const p = createPurchases(sdk, 'k');
  const seen: string[][] = [];
  const off = p.onEntitlementsChange((a) => seen.push(a));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(registered);
  registered!(info('cat_deep-desires'));
  assert.deepEqual(seen, [['cat_deep-desires']]);
  off();
  assert.equal(calls.removed, 1);
});

test('listener cleanup before configure finishes never registers', async () => {
  const { sdk, calls } = fakeSdk();
  const p = createPurchases(sdk, 'k');
  const off = p.onEntitlementsChange(() => {});
  off();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.added, 0);
  assert.equal(calls.removed, 0);
});
