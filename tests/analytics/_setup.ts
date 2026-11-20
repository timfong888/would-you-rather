// Browser globals and env for lib/analytics.ts; must be imported before it (module-load reads).
type Store = Map<string, string>;
export const local: Store = new Map();
export const session: Store = new Map();
export const writes: string[] = [];
const mkStorage = (m: Store, name: string) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => { writes.push(`${name}.set ${k}`); m.set(k, v); },
  removeItem: (k: string) => void m.delete(k),
  key: (i: number) => [...m.keys()][i] ?? null,
  get length() { return m.size; },
});
const win: any = { location: { pathname: '/', search: '', href: 'https://www.wouldyourather.fyi/', host: 'www.wouldyourather.fyi', hostname: 'www.wouldyourather.fyi' } };
(globalThis as any).window = win;
(globalThis as any).document = { referrer: '', cookie: '' };
(globalThis as any).localStorage = mkStorage(local, 'local');
(globalThis as any).sessionStorage = mkStorage(session, 'session');
win.localStorage = (globalThis as any).localStorage;
process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';

export const go = (path: string, search = '', referrer = '') => {
  win.location.pathname = path;
  win.location.search = search;
  win.location.href = `https://www.wouldyourather.fyi${path}${search}`;
  (globalThis as any).document.referrer = referrer;
};

