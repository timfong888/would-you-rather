import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
// @ts-ignore: plain .mjs script
import { pngSize, shotProblems, plan, WIDTH, HEIGHT } from '../../scripts/asc-iap-review-screenshot.mjs';
// @ts-ignore: plain .mjs script
import { shotPlan, FORBIDDEN } from '../../scripts/render-iap-review-screenshots.mjs';

const spec = JSON.parse(readFileSync('store/ios/iap-products.json', 'utf8'));

// The first 8 products have shots. The 18 added by F5a (#252) are marked reviewShot "device" in the product file.
const NO_SHOT_YET = (productId: string) => spec.products.find((p: any) => p.productId === productId).reviewShot === 'device';

test('every IAP with a paywall to shoot has a committed 1290x2796 PNG review screenshot; the other 18 are listed', () => {
  let pending = 0;
  for (const p of spec.products) {
    const f = `store/ios/iap-review/${p.productId}.png`;
    if (NO_SHOT_YET(p.productId)) {
      pending++;
      assert.equal(existsSync(f), false, `${f}: a shot now exists, remove ${p.productId} from the pending rule`);
      continue;
    }
    assert.ok(existsSync(f), f);
    assert.deepEqual(shotProblems(p.productId, readFileSync(f)), [], f);
    assert.deepEqual(pngSize(readFileSync(f)), { width: WIDTH, height: HEIGHT });
  }
  assert.equal(pending, 18, '4 grown-up part 2 + 14 kids and teen');
  // The marked ones are exactly part 2 and later, plus every kids and teen product.
  const marked = spec.products.filter((p: any) => p.reviewShot === 'device').map((p: any) => p.productId).sort();
  const expected = spec.products.map((p: any) => p.productId).filter((id: string) => /_\d+$/.test(id) || /^wyr_unlock_(tiny_choices|make_believe|giggle_factory|road_trip_rally|dinner_table|heart_to_heart|future_me|real_talk|holiday_table)$/.test(id)).sort();
  assert.deepEqual(marked, expected);
});

test('shotProblems rejects missing, non-PNG and wrong-size files', () => {
  assert.match(shotProblems('x', null)[0], /no screenshot/);
  assert.match(shotProblems('x', Buffer.from('not a png at all, definitely not'))[0], /not a PNG/);
  const png = readFileSync('store/ios/iap-review/wyr_premium_all.png');
  const small = Buffer.from(png);
  small.writeUInt32BE(640, 16);
  assert.match(shotProblems('x', small)[0], /640x2796/);
});

test('plan uploads where missing, skips existing, replaces only when asked', () => {
  const products = [{ productId: 'a' }, { productId: 'b' }, { productId: 'c' }];
  const iaps = new Map([['a', { id: '1', state: 'MISSING_METADATA' }], ['b', { id: '2', state: 'READY_TO_SUBMIT' }]]);
  const existing = new Map([['1', undefined], ['2', 'shot2']]);
  assert.deepEqual(plan(products, iaps, existing).map((s: any) => s.action), ['upload', 'skip', 'missing-iap']);
  assert.deepEqual(plan(products, iaps, existing, { replace: true }).map((s: any) => s.action), ['upload', 'replace', 'missing-iap']);
});

test('each shot sells its own product at its approved price, never a free unlock', () => {
  const shots = shotPlan(spec.products);
  assert.equal(shots.length, 26);
  for (const s of shots) {
    assert.ok(s.mustShow.includes(`$${s.priceUsd}`), s.productId);
    assert.equal(s.renderable, !NO_SHOT_YET(s.productId), s.productId);
    if (s.renderable && s.productId !== 'wyr_premium_all') assert.equal(s.route, `/unlock/${s.productId.replace('wyr_unlock_', '').replace(/_/g, '-')}`);
  }
  assert.equal(shots.filter((x: any) => x.renderable).length, 8);
  assert.deepEqual(FORBIDDEN, ['FREE FOR NOW', 'TEST MODE']);
});

test('the upload workflow is manual, dry run by default, and needs a typed confirmation', () => {
  const wf = readFileSync('.github/workflows/apple-iap-review-screenshot.yml', 'utf8');
  assert.match(wf, /on:\s*\n\s*workflow_dispatch:/);
  assert.match(wf, /default: false/);
  assert.match(wf, /inputs\.confirm != 'UPLOAD-IAP-SCREENSHOTS'/);
  const src = readFileSync('scripts/asc-iap-review-screenshot.mjs', 'utf8');
  assert.doesNotMatch(src, /appStoreVersionSubmissions|reviewSubmissions|inAppPurchaseSubmissions/);
});

test('the upload script fails for a product without a shot unless it is marked for a device shot (P3 on #254)', () => {
  const src = readFileSync('scripts/asc-iap-review-screenshot.mjs', 'utf8');
  assert.match(src, /spec\.products\.filter\(\(p\) => p\.reviewShot !== 'device'\)/);
  assert.match(src, /shot\.flatMap\(\(p\) => shotProblems\(p\.productId, files\.get\(p\.productId\)\)\)/);
  // An unmarked product with a missing file is a problem, a marked one is not part of the check.
  assert.match(shotProblems('wyr_unlock_high_life', null)[0], /no screenshot/);
});
