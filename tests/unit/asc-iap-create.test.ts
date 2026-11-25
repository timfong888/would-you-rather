import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCatalog } from '../../lib/catalog';
// @ts-ignore: plain .mjs script
import { validateProducts, findPricePoint } from '../../scripts/asc-iap-create.mjs';

const spec = JSON.parse(readFileSync('store/ios/iap-products.json', 'utf8'));

test('IAP product file matches the catalog: same ids, approved prices', () => {
  const catalog = buildCatalog();
  assert.deepEqual(spec.products.map((p: any) => p.productId).sort(), catalog.map((c) => c.productId).sort());
  for (const c of catalog) {
    const p = spec.products.find((x: any) => x.productId === c.productId);
    assert.equal(Math.round(Number(p.priceUsd) * 1_000_000), c.priceMicros, c.productId);
  }
});

test('IAP product text is the catalog text, so a purchase sheet says what it opens', () => {
  for (const c of buildCatalog()) {
    const p = spec.products.find((x: any) => x.productId === c.productId);
    assert.equal(p.displayName, c.title, c.productId);
    assert.equal(p.description, c.description, c.productId);
  }
});

test('IAP product file passes App Store Connect field limits', () => {
  assert.deepEqual(validateProducts(spec), []);
  assert.equal(spec.products.length, 17, 'pack + 7 grown-up + 9 kids and teen, one per category (D22, #255)');
});

test('validation catches bad entries', () => {
  const bad = { type: 'CONSUMABLE', products: [{ productId: 'a b', referenceName: '', displayName: 'x'.repeat(31), description: 'y'.repeat(46), priceUsd: '1.9' }] };
  assert.equal(validateProducts(bad).length, 6);
});

test('price point lookup matches the customer price exactly', () => {
  const pts = [{ id: 'a', attributes: { customerPrice: '0.99' } }, { id: 'b', attributes: { customerPrice: '1.99' } }, { id: 'c', attributes: { customerPrice: '4.99' } }];
  assert.equal(findPricePoint(pts, '1.99').id, 'b');
  assert.equal(findPricePoint(pts, '4.99').id, 'c');
  assert.equal(findPricePoint(pts, '2.49'), null);
});

test('the workflow defaults to a dry run and needs a typed confirmation to write', () => {
  const wf = readFileSync('.github/workflows/apple-iap-create.yml', 'utf8');
  assert.match(wf, /workflow_dispatch:/);
  assert.doesNotMatch(wf, /\n  (push|pull_request|schedule):/);
  assert.match(wf, /default: false/);
  assert.match(wf, /inputs\.apply && inputs\.confirm != 'CREATE-9-IAPS'/);
});
