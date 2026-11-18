/**
 * Table-driven checks for lib/attribution.ts and lib/activation.ts (#52).
 * Run by `npm run build:web`; exits non-zero on the first failing case.
 */
import { classifyAttribution, getFirstTouch, toFirstTouchProps, FIRST_TOUCH_KEY, type StorageLike } from '../lib/attribution';
import { recordActivationVote, parseActivationState, ACTIVATION_VOTES } from '../lib/activation';

const SITE = 'www.wouldyourather.fyi';
const page = (path = '/', qs = '') => `https://${SITE}${path}${qs}`;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failed++;
    console.error(`FAIL ${name}`, detail ?? '');
  }
}

const channelCases: [string, { referrer?: string | null; url?: string | null }, string][] = [
  ['link_id beats everything', { referrer: 'https://www.google.com/', url: page('/p/hl-1', '?link_id=abc&gen=2&utm_medium=social') }, 'shared_link'],
  ['utm_medium=social', { url: page('/', '?utm_medium=social&utm_source=tiktok') }, 'social'],
  ['utm_medium=email', { url: page('/', '?utm_medium=email') }, 'email'],
  ['utm_medium=cpc', { url: page('/', '?utm_medium=cpc') }, 'paid'],
  ['utm_medium=ppc', { url: page('/', '?utm_medium=PPC') }, 'paid'],
  ['utm_medium=paid', { url: page('/', '?utm_medium=paid') }, 'paid'],
  ['utm_medium=organic', { url: page('/', '?utm_medium=organic') }, 'organic_search'],
  ['unknown utm_medium falls through to referrer', { referrer: 'https://www.google.com/', url: page('/', '?utm_medium=banner') }, 'organic_search'],
  ['same-site referrer', { referrer: `https://${SITE}/categories`, url: page('/game/hl-1') }, 'internal'],
  ['same-site referrer without www', { referrer: 'https://wouldyourather.fyi/', url: page('/') }, 'internal'],
  ['google.com', { referrer: 'https://www.google.com/search?q=x', url: page('/') }, 'organic_search'],
  ['google.co.uk', { referrer: 'https://www.google.co.uk/', url: page('/') }, 'organic_search'],
  ['bing', { referrer: 'https://www.bing.com/', url: page('/') }, 'organic_search'],
  ['duckduckgo', { referrer: 'https://duckduckgo.com/', url: page('/') }, 'organic_search'],
  ['search.yahoo.com', { referrer: 'https://search.yahoo.com/', url: page('/') }, 'organic_search'],
  ['brave search', { referrer: 'https://search.brave.com/', url: page('/') }, 'organic_search'],
  ['yandex.ru', { referrer: 'https://yandex.ru/', url: page('/') }, 'organic_search'],
  ['facebook l.', { referrer: 'https://l.facebook.com/l.php?u=x', url: page('/') }, 'social'],
  ['instagram l.', { referrer: 'https://l.instagram.com/', url: page('/') }, 'social'],
  ['t.co', { referrer: 'https://t.co/abc', url: page('/') }, 'social'],
  ['x.com', { referrer: 'https://x.com/', url: page('/') }, 'social'],
  ['tiktok', { referrer: 'https://www.tiktok.com/', url: page('/') }, 'social'],
  ['reddit', { referrer: 'https://www.reddit.com/r/x', url: page('/') }, 'social'],
  ['pinterest.co.uk', { referrer: 'https://www.pinterest.co.uk/', url: page('/') }, 'social'],
  ['lnkd.in', { referrer: 'https://lnkd.in/x', url: page('/') }, 'social'],
  ['other site', { referrer: 'https://someblog.example/post', url: page('/') }, 'referral'],
  ['lookalike host is not google', { referrer: 'https://notgoogle.com/', url: page('/') }, 'referral'],
  ['no referrer', { referrer: '', url: page('/') }, 'direct'],
  ['malformed referrer', { referrer: 'not a url', url: page('/') }, 'direct'],
  ['missing url and referrer', {}, 'direct'],
];
for (const [name, input, want] of channelCases) {
  const got = classifyAttribution({ ...input, siteHost: SITE });
  check(`channel: ${name}`, got.channel === want, { got: got.channel, want });
}

// Privacy: referrer and landing_path never carry a query string or hash.
{
  const a = classifyAttribution({
    referrer: 'https://www.google.com/search?q=secret#frag',
    url: page('/questions-for-couples', '?utm_source=g&utm_medium=cpc&utm_campaign=c&link_id=zz#top'),
    siteHost: SITE,
  });
  check('referrer has no query/hash', a.referrer === 'https://www.google.com/search', a.referrer);
  check('landing_path has no query/hash', a.landing_path === '/questions-for-couples', a.landing_path);
  check('utm fields captured', a.utm_source === 'g' && a.utm_medium === 'cpc' && a.utm_campaign === 'c', a);
  check('referring_domain', a.referring_domain === 'www.google.com', a.referring_domain);
}

// First touch: persists once, survives reload, tolerates blocked storage.
{
  const mem = new Map<string, string>();
  const storage: StorageLike = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  const google = classifyAttribution({ referrer: 'https://www.google.com/', url: page('/questions-for-couples'), siteHost: SITE });
  const later = classifyAttribution({ referrer: '', url: page('/'), siteHost: SITE });
  const first = getFirstTouch(google, storage);
  const again = getFirstTouch(later, storage);
  check('first touch persisted', first.channel === 'organic_search' && mem.has(FIRST_TOUCH_KEY));
  check('first touch survives a later direct visit', again.channel === 'organic_search' && again.landing_path === '/questions-for-couples', again);
  const props = toFirstTouchProps(again);
  check('first_* props', props.first_channel === 'organic_search' && props.first_landing_path === '/questions-for-couples' && !('first_utm_source' in props), props);

  const mem2 = new Map<string, string>();
  const internalOnly = getFirstTouch(classifyAttribution({ referrer: `https://${SITE}/`, url: page('/') , siteHost: SITE }), { getItem: (k) => mem2.get(k) ?? null, setItem: (k, v) => void mem2.set(k, v) });
  check('internal referrer is not stored as first touch', internalOnly.channel === 'internal' && mem2.size === 0);

  const blocked: StorageLike = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  let threw = false;
  let fallback;
  try { fallback = getFirstTouch(google, blocked); } catch { threw = true; }
  check('blocked storage does not throw and falls back', !threw && fallback?.channel === 'organic_search');
  check('missing storage falls back', getFirstTouch(google, null).channel === 'organic_search');
  mem.set(FIRST_TOUCH_KEY, '{not json');
  check('corrupt stored value falls back', getFirstTouch(later, storage).channel === 'direct');
}

// Activation: fires once, on the Nth vote of the first session only.
{
  let s = parseActivationState(null);
  const fires: boolean[] = [];
  for (let i = 0; i < ACTIVATION_VOTES + 2; i++) {
    const r = recordActivationVote(s, true);
    s = r.state;
    fires.push(r.fire);
  }
  const want = fires.map((_, i) => i === ACTIVATION_VOTES - 1);
  check('activation fires exactly once, on the threshold vote', JSON.stringify(fires) === JSON.stringify(want), fires);

  const later = recordActivationVote(parseActivationState(null), false);
  check('votes outside the first session never activate', !later.fire && later.state.votes === 0);
  check('corrupt activation state resets', parseActivationState('{oops').votes === 0);
  check('persisted activated state never re-fires', !recordActivationVote({ votes: 3, activated: true }, true).fire);
}

if (failed) {
  console.error(`verify-attribution: ${failed} failing case(s)`);
  process.exit(1);
}
console.log(`verify-attribution: OK — ${channelCases.length} channel cases plus privacy, first-touch and activation checks`);
