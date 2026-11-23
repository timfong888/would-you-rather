import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain .mjs module
import { buildRows, makeRedactor, toMarkdown, compileMatch } from '../../scripts/lib/ascAppsList.mjs';

const API = 'https://api.appstoreconnect.apple.com';
const SECRET_KEY = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49\n-----END PRIVATE KEY-----';

// Mock ASC: 3 apps over 2 pages, each with an app store version; builds per app.
function mockGet(calls: string[] = []) {
  const app = (id: string, name: string, bundleId: string, vid: string) => ({
    id, type: 'apps', attributes: { name, bundleId },
    relationships: { appStoreVersions: { data: [{ type: 'appStoreVersions', id: vid }] } },
  });
  const ver = (id: string, state: string) => ({ id, type: 'appStoreVersions', attributes: { platform: 'IOS', appStoreState: state, versionString: '1.0.0' } });
  const builds: Record<string, any> = {
    '1': { version: '42', processingState: 'VALID' },
    '2': { version: '7', processingState: 'PROCESSING' },
  };
  return async (path: string) => {
    calls.push(path);
    if (path.startsWith('/v1/apps') && !path.includes('page2')) {
      return { status: 200, body: {
        data: [app('1', 'Would You Rather', 'com.example.wyr', 'v1'), app('2', 'Neville Notes', 'com.example.notes', 'v2')],
        included: [ver('v1', 'READY_FOR_SALE'), ver('v2', 'PREPARE_FOR_SUBMISSION')],
        links: { next: `${API}/v1/apps?cursor=page2` },
      } };
    }
    if (path.startsWith('/v1/apps')) {
      return { status: 200, body: {
        data: [app('3', 'Timer', 'com.example.nevilleTimer', 'v3')],
        included: [ver('v3', 'READY_FOR_SALE')],
      } };
    }
    const m = path.match(/filter\[app\]=(\d+)/);
    const b = m && builds[m[1]];
    return { status: 200, body: { data: b ? [{ type: 'builds', id: 'b', attributes: b }] : [] } };
  };
}

test('paginates apps across pages and fetches the latest build per app', async () => {
  const calls: string[] = [];
  const rows = await buildRows(mockGet(calls));
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r: any) => r.appleAppId), ['1', '2', '3']);
  assert.equal(rows[0].buildNumber, '42');
  assert.equal(rows[0].buildState, 'VALID');
  assert.equal(rows[1].buildState, 'PROCESSING');
  assert.equal(rows[2].buildNumber, '-'); // no builds
  assert.match(rows[0].appStoreState, /READY_FOR_SALE/);
  assert.equal(rows[0].platform, 'IOS');
  assert.ok(calls.some((c) => c.includes('cursor=page2')), 'followed links.next');
});

test('flags neville in the name or bundle ID, case-insensitively', async () => {
  const rows = await buildRows(mockGet());
  assert.deepEqual(rows.map((r: any) => r.neville), [false, true, true]);
  assert.match(toMarkdown(rows), /NEVILLE \| Neville Notes/);
});

test('match regexp filters by name or bundle ID; invalid regexp is a clear error', async () => {
  const rows = await buildRows(mockGet(), { match: '^timer$|wyr' });
  assert.deepEqual(rows.map((r: any) => r.appleAppId), ['1', '3']);
  assert.throws(() => compileMatch('('), /Invalid match regexp/);
});

test('a failed page throws instead of returning a partial list', async () => {
  const get = async (p: string) => (p.includes('page2') ? { status: 500, body: {} } : mockGet()(p));
  await assert.rejects(() => buildRows(get), /HTTP 500/);
});

test('only GET paths are used and no secret reaches the output', async () => {
  const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJ4In0.c2ln';
  const redact = makeRedactor(['KEYID12345', 'issuer-uuid-1234', SECRET_KEY]);
  const rows = await buildRows(mockGet());
  const md = toMarkdown(rows);
  const noisy = `${md}\nkey=KEYID12345 iss=issuer-uuid-1234 ${SECRET_KEY} ${SECRET_KEY.replace(/\n/g, '\\n')} Bearer ${jwt}`;
  const out = redact(noisy);
  for (const s of ['KEYID12345', 'issuer-uuid-1234', 'MIGTAgEAMBMGByqGSM49', jwt]) assert.ok(!out.includes(s), `leaked ${s}`);
  assert.ok(out.includes('Would You Rather'));
});
