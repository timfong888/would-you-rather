import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisitorId, purgeStoredVisitorId, analyticsAllowed, VISITOR_KEY } from '../../lib/visitorId';
import { isKidsPath } from '../../lib/kidsPaths';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const writes: string[] = [];
  return {
    data, writes,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { writes.push(`set:${k}`); data[k] = v; },
    removeItem: (k: string) => { writes.push(`rm:${k}`); delete data[k]; },
  } as unknown as Storage & { data: Record<string, string>; writes: string[] };
}
let n = 0;
const uuid = () => `id-${++n}`;

test('adult routes: the visitor ID is persisted and reused', () => {
  const st = fakeStorage();
  const mem = {};
  const first = resolveVisitorId({ kids: false, storage: st, uuid, memory: mem });
  assert.equal(first.isNew, true);
  assert.equal(st.data[VISITOR_KEY], first.id);
  const again = resolveVisitorId({ kids: false, storage: st, uuid, memory: mem });
  assert.deepEqual(again, { id: first.id, isNew: false });
});

test('kids routes: nothing is read or written, an in-memory ID is used, and a stored ID is removed', () => {
  const st = fakeStorage({ [VISITOR_KEY]: 'persisted-adult-id', other: 'x' });
  const mem: { id?: string } = {};
  const a = resolveVisitorId({ kids: true, storage: st, uuid, memory: mem });
  assert.notEqual(a.id, 'persisted-adult-id');
  assert.equal(VISITOR_KEY in st.data, false);
  assert.equal(st.data.other, 'x');
  assert.deepEqual(st.writes, [`rm:${VISITOR_KEY}`]); // no setItem, no getItem needed
  const b = resolveVisitorId({ kids: true, storage: st, uuid, memory: mem });
  assert.equal(b.id, a.id); // same in-memory ID for the page's life
  assert.ok(!st.writes.some((w) => w.startsWith('set:')));
});

test('kids routes with no storage at all still return an in-memory ID', () => {
  const r = resolveVisitorId({ kids: true, storage: null, uuid, memory: {} });
  assert.ok(r.id);
});

test('purgeStoredVisitorId removes only the visitor key and tolerates a broken storage', () => {
  const st = fakeStorage({ [VISITOR_KEY]: 'x', wyr_voted_v1: '{}', wyr_answered_questions: '{}' });
  purgeStoredVisitorId(st);
  assert.deepEqual(Object.keys(st.data).sort(), ['wyr_answered_questions', 'wyr_voted_v1']);
  assert.doesNotThrow(() => purgeStoredVisitorId({ removeItem: () => { throw new Error('denied'); } }));
  assert.doesNotThrow(() => purgeStoredVisitorId(null));
});

test('analytics is off on kids routes and on everywhere else', () => {
  for (const p of ['/game/kf-2', '/p/kf-9', '/results/kf-1', '/categories/kids-family', '/complete/kids-family', '/unlock/kids-family', '/would-you-rather-questions-for-kids', '/funny-would-you-rather-questions-for-kids/']) {
    assert.equal(analyticsAllowed(p, isKidsPath), false, p);
  }
  for (const p of ['/', '/game/sb-1', '/categories', '/categories/social-blunders', '/questions-for-couples', '/privacy', undefined]) {
    assert.equal(analyticsAllowed(p, isKidsPath), true, String(p));
  }
});
