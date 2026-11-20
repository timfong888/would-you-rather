import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebPurchases, webKeyUsable, WEB_USER_STORAGE_KEY } from '../../lib/purchases-web-core';
import type { WebCustomerInfo, WebPackage, WebPurchasesInstance, WebSdkModule, KeyValueStore } from '../../lib/purchases-web-core';

const info = (...ids: string[]): WebCustomerInfo => ({ entitlements: { active: Object.fromEntries(ids.map((i) => [i, {}])) } });
const pkg = (id: string, price: string): WebPackage => ({ webBillingProduct: { identifier: id, currentPrice: { formattedPrice: price } } });

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, get: (k) => data[k] ?? null, set: (k, v) => void (data[k] = v) };
}

function fakeSdk(instance: Partial<WebPurchasesInstance> = {}) {
  const calls = { load: 0, configure: [] as { apiKey: string; appUserId: string }[], purchased: [] as string[] };
  const inst: WebPurchasesInstance = {
    getCustomerInfo: async () => info('cat_high-life'),
    getOfferings: async () => ({
      all: { default: { availablePackages: [pkg('wyr_premium_all', '$4.99'), pkg('wyr_unlock_high_life', '$1.99')] } },
      current: null,
    }),
    purchase: async ({ rcPackage }) => {
      calls.purchased.push(rcPackage.webBillingProduct.identifier);
      return { customerInfo: info('cat_high-life', 'premium_all') };
    },
    ...instance,
  };
  const sdk: WebSdkModule = {
    configure: (c) => {
      calls.configure.push(c);
      return inst;
    },
    generateRevenueCatAnonymousAppUserId: () => '$RCAnonymousID:abc',
  };
  const loadSdk = async () => {
    calls.load++;
    return sdk;
  };
  return { loadSdk, calls };
}

const SANDBOX = 'rcb_sb_123';
const LIVE = 'rcb_456';

test('key rules: sandbox key refused on production, live key anywhere, other keys never', () => {
  assert.equal(webKeyUsable(SANDBOX, 'preview'), true);
  assert.equal(webKeyUsable(SANDBOX, 'development'), true);
  assert.equal(webKeyUsable(SANDBOX, 'production'), false);
  assert.equal(webKeyUsable(SANDBOX, undefined), false); // unknown env = production
  assert.equal(webKeyUsable(LIVE, 'production'), true);
  assert.equal(webKeyUsable('test_abc', 'preview'), false);
  assert.equal(webKeyUsable('appl_abc', 'preview'), false);
  assert.equal(webKeyUsable(undefined, 'preview'), false);
});

test('no key: unavailable, never loads the SDK, purchase throws', async () => {
  const { loadSdk, calls } = fakeSdk();
  const p = createWebPurchases({ apiKey: undefined, deployEnv: 'preview', loadSdk, store: memStore() });
  assert.equal(p.isAvailable(), false);
  assert.deepEqual(await p.getEntitlements(), []);
  await assert.rejects(p.purchase('wyr_unlock_high_life'));
  await assert.rejects(p.restore());
  assert.equal(calls.load, 0);
});

test('browsing creates no user id and sends nothing to RevenueCat', async () => {
  const { loadSdk, calls } = fakeSdk();
  const store = memStore();
  const p = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk, store });
  assert.equal(p.isAvailable(), true);
  assert.deepEqual(await p.getEntitlements(), []);
  assert.deepEqual(await p.getPrices(), {});
  assert.deepEqual(await p.restore(), []);
  assert.equal(calls.load, 0);
  assert.equal(store.data[WEB_USER_STORAGE_KEY], undefined);
});

test('first purchase creates and stores an anonymous id, buys the right package, returns entitlements', async () => {
  const { loadSdk, calls } = fakeSdk();
  const store = memStore();
  const p = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk, store });
  const r = await p.purchase('wyr_unlock_high_life');
  assert.deepEqual(r, { status: 'success', entitlements: ['cat_high-life', 'premium_all'] });
  assert.equal(store.data[WEB_USER_STORAGE_KEY], '$RCAnonymousID:abc');
  assert.deepEqual(calls.configure, [{ apiKey: SANDBOX, appUserId: '$RCAnonymousID:abc' }]);
  assert.deepEqual(calls.purchased, ['wyr_unlock_high_life']);
  // Configured once; later calls reuse it.
  await p.getEntitlements();
  assert.equal(calls.configure.length, 1);
});

test('a returning buyer: entitlements and prices are read for the stored id', async () => {
  const { loadSdk, calls } = fakeSdk();
  const store = memStore({ [WEB_USER_STORAGE_KEY]: 'user-1' });
  const p = createWebPurchases({ apiKey: LIVE, deployEnv: 'production', loadSdk, store });
  assert.deepEqual(await p.getEntitlements(), ['cat_high-life']);
  assert.deepEqual(await p.getPrices(), { wyr_premium_all: '$4.99', wyr_unlock_high_life: '$1.99' });
  assert.deepEqual(await p.restore(), ['cat_high-life']);
  assert.equal(calls.configure[0].appUserId, 'user-1');
});

test('user cancel resolves cancelled; other errors throw', async () => {
  const cancel = fakeSdk({ purchase: async () => Promise.reject(Object.assign(new Error('x'), { errorCode: 1 })) });
  const p1 = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk: cancel.loadSdk, store: memStore() });
  assert.deepEqual(await p1.purchase('wyr_premium_all'), { status: 'cancelled' });

  const fail = fakeSdk({ purchase: async () => Promise.reject(Object.assign(new Error('card declined'), { errorCode: 7 })) });
  const p2 = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk: fail.loadSdk, store: memStore() });
  await assert.rejects(p2.purchase('wyr_premium_all'), /card declined/);
});

test('unknown product throws a readable error and charges nothing', async () => {
  const { loadSdk, calls } = fakeSdk();
  const p = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk, store: memStore() });
  await assert.rejects(p.purchase('wyr_unlock_nope'), /not available/);
  assert.deepEqual(calls.purchased, []);
});

test('sandbox key on production: unavailable, so no test-mode checkout on the live site', async () => {
  const { loadSdk, calls } = fakeSdk();
  const p = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'production', loadSdk, store: memStore() });
  assert.equal(p.isAvailable(), false);
  await assert.rejects(p.purchase('wyr_premium_all'));
  assert.equal(calls.load, 0);
});

test('a failed SDK load is retried on the next call', async () => {
  let n = 0;
  const good = fakeSdk();
  const loadSdk = async () => {
    if (n++ === 0) throw new Error('network');
    return good.loadSdk();
  };
  const p = createWebPurchases({ apiKey: SANDBOX, deployEnv: 'preview', loadSdk, store: memStore({ [WEB_USER_STORAGE_KEY]: 'u' }) });
  await assert.rejects(p.getEntitlements(), /network/);
  assert.deepEqual(await p.getEntitlements(), ['cat_high-life']);
});
