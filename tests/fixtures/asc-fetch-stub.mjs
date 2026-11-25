// Preload for tests: replaces fetch, records each request as a JSON line on stderr-free file, returns canned ASC bodies.
import { appendFileSync } from 'node:fs';
const log = process.env.ASC_STUB_LOG;
globalThis.fetch = async (url, init = {}) => {
  appendFileSync(log, JSON.stringify({ url: String(url), method: init.method ?? 'GET', hasBody: init.body !== undefined }) + '\n');
  const u = String(url);
  let body = { data: [] };
  if (u.includes('/inAppPurchasesV2')) {
    body = { data: [{ id: '111', type: 'inAppPurchases', attributes: { productId: 'p1', state: 'READY_TO_SUBMIT' } }] };
  } else if (u.includes('/v1/builds')) {
    body = { data: [{ id: 'b1', type: 'builds', attributes: { version: '23', iconAssetToken: { templateUrl: 'https://is1-ssl.mzstatic.com/secret-token/{w}x{h}.{f}', width: 1024, height: 1024 } } }] };
  } else if (u.includes('/images')) {
    body = { data: [{ id: 'i1', type: 'inAppPurchaseImages', attributes: { fileName: 'a.png', imageAsset: 'https://x.test/?token=abc' } }] };
  }
  return { status: 200, text: async () => JSON.stringify(body) };
};
