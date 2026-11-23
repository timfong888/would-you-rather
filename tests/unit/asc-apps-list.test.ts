import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain .mjs module
import { buildRows, makeRedactor, toMarkdown, compileMatch } from '../../scripts/lib/ascAppsList.mjs';

const API = 'https://api.appstoreconnect.apple.com';
const SECRET_KEY = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49\n-----END PRIVATE KEY-----';

type Ver = { id: string; state: string; created?: string; version?: string };
const app = (id: string, name: string, bundleId: string, vers: Ver[], total = vers.length) => ({
  id, type: 'apps', attributes: { name, bundleId },
  relationships: { appStoreVersions: { data: vers.map((v) => ({ type: 'appStoreVersions', id: v.id })), meta: { paging: { total } } } },
});
const ver = (v: Ver) => ({ id: v.id, type: 'appStoreVersions', attributes: { platform: 'IOS', appStoreState: v.state, versionString: v.version ?? '1.0.0', createdDate: v.created } });

// Mock ASC, 4 apps over 2 pages:
//  1 Would You Rather  released
//  2 Neville Notes     NOT released (draft)
//  3 Timer             released, bundle id contains "neville"
//  4 Secret Project    NOT released
function mockGet(calls: string[] = []) {
  const v = { v1: { id: 'v1', state: 'READY_FOR_SALE' }, v2: { id: 'v2', state: 'PREPARE_FOR_SUBMISSION' },
    v3: { id: 'v3', state: 'READY_FOR_SALE' }, v4: { id: 'v4', state: 'PREPARE_FOR_SUBMISSION' } };
  const builds: Record<string, any> = {
    '1': { version: '42', processingState: 'VALID' },
    '3': { version: '7', processingState: 'PROCESSING' },
  };
  return async (path: string) => {
    calls.push(path);
    if (path.startsWith('/v1/apps') && !path.includes('page2')) {
      return { status: 200, body: {
        data: [app('1', 'Would You Rather', 'com.example.wyr', [v.v1]), app('2', 'Neville Notes', 'com.example.notes', [v.v2])],
        included: [ver(v.v1), ver(v.v2)],
        links: { next: `${API}/v1/apps?cursor=page2` },
      } };
    }
    if (path.startsWith('/v1/apps')) {
      return { status: 200, body: {
        data: [app('3', 'Timer', 'com.example.nevilleTimer', [v.v3]), app('4', 'Secret Project', 'com.example.secret', [v.v4])],
        included: [ver(v.v3), ver(v.v4)],
      } };
    }
    const m = path.match(/filter\[app\]=(\d+)/);
    const b = m && builds[m[1]];
    return { status: 200, body: { data: b ? [{ type: 'builds', id: 'b', attributes: b }] : [] } };
  };
}

test('paginates apps across pages and fetches the latest build per released app', async () => {
  const calls: string[] = [];
  const { rows, total } = await buildRows(mockGet(calls));
  assert.equal(total, 4);
  assert.deepEqual(rows.map((r: any) => r.appleAppId), ['1', '3']);
  assert.equal(rows[0].buildNumber, '42');
  assert.equal(rows[0].buildState, 'VALID');
  assert.equal(rows[1].buildState, 'PROCESSING');
  assert.match(rows[0].appStoreState, /READY_FOR_SALE/);
  assert.ok(calls.some((c) => c.includes('cursor=page2')), 'followed links.next');
  // builds are never even requested for unreleased apps
  assert.ok(!calls.some((c) => c.includes('filter[app]=2') || c.includes('filter[app]=4')));
});

test('output is released-only: unreleased apps are a count, with no name, bundle ID or id anywhere', async () => {
  const { rows, total, hidden } = await buildRows(mockGet());
  assert.deepEqual(hidden, { count: 2, neville: true });
  const md = toMarkdown(rows, { total, hidden });
  assert.match(md, /2 more apps not shown \(not released\)/);
  assert.match(md, /A Neville app exists \(not released\)/);
  for (const leak of ['Neville Notes', 'com.example.notes', 'Secret Project', 'com.example.secret', 'PREPARE_FOR_SUBMISSION']) {
    assert.ok(!md.includes(leak), `leaked ${leak}`);
  }
  assert.ok(!/\| (2|4) \|/.test(md), 'no unreleased app id');
  assert.ok(md.includes('Would You Rather'));
});

test('flags neville in the name or bundle ID of a released app, case-insensitively', async () => {
  const { rows } = await buildRows(mockGet());
  assert.deepEqual(rows.map((r: any) => r.neville), [false, true]);
  assert.match(toMarkdown(rows), /NEVILLE \| Timer/);
});

test('an unreleased neville app only produces the one-line notice', async () => {
  const { rows, hidden } = await buildRows(mockGet(), { match: 'neville' });
  assert.deepEqual(rows.map((r: any) => r.appleAppId), ['3']);
  assert.deepEqual(hidden, { count: 1, neville: true });
});

test('match regexp filters by name or bundle ID; invalid regexp is a clear error', async () => {
  const { rows, total, hidden } = await buildRows(mockGet(), { match: '^timer$|wyr' });
  assert.deepEqual(rows.map((r: any) => r.appleAppId), ['1', '3']);
  assert.equal(total, 4);
  assert.deepEqual(hidden, { count: 0, neville: false });
  assert.throws(() => compileMatch('('), /Invalid match regexp/);
});

test('a failed page throws instead of returning a partial list, without naming an app', async () => {
  const get = async (p: string) => (p.includes('page2') ? { status: 500, body: {} } : mockGet()(p));
  await assert.rejects(() => buildRows(get), /HTTP 500/);
});

test('keeps only the newest version per platform; missing createdDate sorts oldest', async () => {
  const mk = (vers: Ver[]) => async (p: string) => p.startsWith('/v1/apps')
    ? { status: 200, body: { data: [app('9', 'Old', 'com.example.old', vers)], included: vers.map(ver) } }
    : { status: 200, body: { data: [] } };
  const a = await buildRows(mk([
    { id: 'a', state: 'REPLACED_WITH_NEW_VERSION', version: '1.0', created: '2025-01-01T00:00:00Z' },
    { id: 'b', state: 'READY_FOR_SALE', version: '2.0', created: '2026-01-01T00:00:00Z' },
  ]));
  assert.equal(a.rows[0].appStoreState, 'IOS 2.0: READY_FOR_SALE');
  const b = await buildRows(mk([
    { id: 'a', state: 'READY_FOR_SALE', version: '1.0', created: '2025-01-01T00:00:00Z' },
    { id: 'b', state: 'PREPARE_FOR_SUBMISSION', version: '2.0' }, // no createdDate
  ]));
  assert.equal(b.rows[0].appStoreState, 'IOS 1.0: READY_FOR_SALE');
  // an app with an older live version and a newer draft still counts as released
  assert.equal(b.rows.length, 1);
});

test('throws instead of silently capping when an app has more versions than were returned', async () => {
  const get = async (p: string) => p.startsWith('/v1/apps')
    ? { status: 200, body: { data: [app('9', 'Big', 'com.example.big', [{ id: 'a', state: 'READY_FOR_SALE' }], 120)], included: [ver({ id: 'a', state: 'READY_FOR_SALE' })] } }
    : { status: 200, body: { data: [] } };
  await assert.rejects(() => buildRows(get), (e: Error) => /120 App Store versions but only 1/.test(e.message) && !/Big|com\.example\.big|\b9\b/.test(e.message));
});

test('no secret reaches the output', async () => {
  const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJ4In0.c2ln';
  const redact = makeRedactor(['KEYID12345', 'issuer-uuid-1234', SECRET_KEY]);
  const { rows, total, hidden } = await buildRows(mockGet());
  const md = toMarkdown(rows, { total, hidden });
  const noisy = `${md}\nkey=KEYID12345 iss=issuer-uuid-1234 ${SECRET_KEY} ${SECRET_KEY.replace(/\n/g, '\\n')} Bearer ${jwt}`;
  const out = redact(noisy);
  for (const s of ['KEYID12345', 'issuer-uuid-1234', 'MIGTAgEAMBMGByqGSM49', jwt]) assert.ok(!out.includes(s), `leaked ${s}`);
  assert.ok(out.includes('Would You Rather'));
});
