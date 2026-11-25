// Preload for tests: replaces fetch, records each request as a JSON line on stderr-free file, returns canned ASC bodies.
import { appendFileSync } from 'node:fs';
const log = process.env.ASC_STUB_LOG;
globalThis.fetch = async (url, init = {}) => {
  appendFileSync(log, JSON.stringify({ url: String(url), method: init.method ?? 'GET', hasBody: init.body !== undefined }) + '\n');
  const u = String(url);
  let body = { data: [] };
  if (u.includes('/inAppPurchasesV2')) {
    if (process.env.ASC_STUB_FAIL_IAP) {
      return { status: 403, text: async () => JSON.stringify({ errors: [{ status: '403', code: 'FORBIDDEN', title: 'No', detail: 'see https://x.test/?token=zzz' }] }) };
    }
    if (u.includes('cursor=2')) {
      body = { data: [{ id: '222', type: 'inAppPurchases', attributes: { productId: 'p2', state: 'READY_TO_SUBMIT' } }] };
    } else {
      body = {
        data: [{ id: '111', type: 'inAppPurchases', attributes: { productId: 'p1', state: 'READY_TO_SUBMIT' } }],
        links: { next: 'https://api.appstoreconnect.apple.com/v1/apps/6836653723/inAppPurchasesV2?limit=50&cursor=2' },
      };
    }
  } else if (u.includes('/appStoreVersions')) {
    body = {
      data: [{ id: 'v1', type: 'appStoreVersions', attributes: { versionString: '1.0', appStoreState: 'PREPARE_FOR_SUBMISSION' }, relationships: { build: { data: { id: 'b1', type: 'builds' } } } }],
      included: [{ id: 'b1', type: 'builds', attributes: { version: '23' } }],
    };
  } else if (u.includes('/v1/builds')) {
    body = { data: [{ id: 'b1', type: 'builds', attributes: { version: '23', iconAssetToken: { templateUrl: 'https://is1-ssl.mzstatic.com/secret-token/{w}x{h}.{f}', width: 1024, height: 1024 } } }] };
  } else if (u.includes('/images')) {
    body = { data: [{ id: 'i1', type: 'inAppPurchaseImages', attributes: { fileName: 'a.png', imageAsset: 'https://x.test/?token=abc' } }] };
  }
  return { status: 200, text: async () => JSON.stringify(body) };
};
