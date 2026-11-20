#!/usr/bin/env tsx
/**
 * Idempotent RevenueCat catalog sync. Run: npm run rc:sync -- --app <app_id>
 *
 * Creates (or reuses) the entitlements, products, offering and packages from
 * lib/catalog.ts, which derives them from constants/questions.ts, so the
 * catalog cannot drift from the code. Running it twice changes nothing.
 *
 * Scope: a RevenueCat Test Store app only (simulated purchases, no money).
 * For App Store / Play apps the store products are created by hand in the
 * store consoles; extend this script to create RevenueCat entries that
 * reference those store identifiers (see docs/payments.md).
 *
 * Auth: REVENUECAT_API_KEY (secret v2 key). In the cloud agent environment the
 * proxy injects it for api.revenuecat.com, so any dummy value works there.
 */
import { buildCatalog, entitlementForCategory, OFFERING_ID, ENTITLEMENT_ALL } from '../../lib/catalog';

const PROJECT = process.env.REVENUECAT_PROJECT_ID ?? 'proj686a561d';
const BASE = `https://api.revenuecat.com/v2/projects/${PROJECT}`;
const KEY = process.env.REVENUECAT_API_KEY ?? 'proxy-injected';

const argApp = process.argv.indexOf('--app');
const APP_ID = argApp > -1 ? process.argv[argApp + 1] : (process.env.REVENUECAT_APP_ID ?? 'app4a3e1a9c34');

async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json.message ?? text}`);
  return json as T;
}

async function listAll(path: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = `${path}${path.includes('?') ? '&' : '?'}limit=100`;
  while (next) {
    const page: any = await api('GET', next);
    out.push(...page.items);
    next = page.next_page ? page.next_page.replace(`/v2/projects/${PROJECT}`, '') : null;
  }
  return out;
}

async function main() {
  const app = (await listAll('/apps')).find((a) => a.id === APP_ID);
  if (!app) throw new Error(`App ${APP_ID} not found in project ${PROJECT}`);
  if (app.type !== 'test_store') {
    throw new Error(`App ${APP_ID} is ${app.type}. This script only creates Test Store products.`);
  }

  const catalog = buildCatalog();
  const products = new Map<string, any>((await listAll('/products')).filter((p) => p.app_id === APP_ID).map((p) => [p.store_identifier, p]));
  const entitlements = new Map<string, any>((await listAll('/entitlements')).map((e) => [e.lookup_key, e]));

  const summary = { products: 0, entitlements: 0, packages: 0 };

  for (const item of catalog) {
    // Product
    let product = products.get(item.productId);
    if (!product) {
      product = await api('POST', '/products', {
        store_identifier: item.productId,
        app_id: APP_ID,
        type: 'non_consumable',
        display_name: item.title,
        title: item.title,
      });
      products.set(item.productId, product);
      summary.products++;
    }
    // Test Store price. A repeat run gets 409 "already exists": that is the
    // idempotent case. To change a Test Store price, delete the product in the
    // dashboard and re-run.
    try {
      await api('POST', `/products/${product.id}/test_store_prices`, {
        prices: [{ currency: 'USD', amount_micros: item.priceMicros }],
      });
    } catch (e) {
      if (!String((e as Error).message).includes('-> 409')) throw e;
    }

    // Entitlement
    let ent = entitlements.get(item.entitlementId);
    if (!ent) {
      ent = await api('POST', '/entitlements', { lookup_key: item.entitlementId, display_name: item.title });
      entitlements.set(item.entitlementId, ent);
      summary.entitlements++;
    }
    const attached = await listAll(`/entitlements/${ent.id}/products`);
    if (!attached.some((p) => p.id === product.id)) {
      await api('POST', `/entitlements/${ent.id}/actions/attach_products`, { product_ids: [product.id] });
    }
  }

  // One offering holding one package per product.
  const offerings = await listAll('/offerings');
  let offering = offerings.find((o) => o.lookup_key === OFFERING_ID);
  if (!offering) {
    offering = await api('POST', '/offerings', { lookup_key: OFFERING_ID, display_name: 'Default' });
  }
  if (!offering.is_current) {
    await api('POST', `/offerings/${offering.id}`, { is_current: true, display_name: offering.display_name ?? 'Default' });
  }
  const packages = await listAll(`/offerings/${offering.id}/packages`);
  for (const item of catalog) {
    const key = item.categoryId ? entitlementForCategory(item.categoryId) : ENTITLEMENT_ALL;
    let pkg = packages.find((p) => p.lookup_key === key);
    if (!pkg) {
      pkg = await api('POST', `/offerings/${offering.id}/packages`, { lookup_key: key, display_name: item.title });
      summary.packages++;
    }
    const product = products.get(item.productId);
    const attachedProducts = await listAll(`/packages/${pkg.id}/products`);
    if (!attachedProducts.some((p) => (p.product?.id ?? p.id) === product.id)) {
      await api('POST', `/packages/${pkg.id}/actions/attach_products`, {
        products: [{ product_id: product.id, eligibility_criteria: 'all' }],
      });
    }
  }

  const keys = await listAll(`/apps/${APP_ID}/public_api_keys`);
  console.log(`Created: ${summary.products} products, ${summary.entitlements} entitlements, ${summary.packages} packages.`);
  console.log(`Catalog: ${catalog.length} products, offering "${OFFERING_ID}".`);
  console.log(`Public SDK key(s) for app ${APP_ID}: ${keys.map((k) => k.key).join(', ')}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
