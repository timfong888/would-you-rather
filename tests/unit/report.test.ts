import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { dailyReport, seoReport, googleAccessToken, topBingQueries, parseBingDate } from '../../scripts/report/core';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('daily report without credentials says which keys are missing and does not throw', async () => {
  const out = await dailyReport((async () => { throw new Error('no network expected'); }) as any, {});
  assert.match(out, /not configured: POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID/);
});

test('daily report summarises visits by source, activation rate and errors from PostHog', async () => {
  const answers: Record<string, any[][]> = {
    "properties.channel": [['organic_search', 40], ['shared_link', 10], [null, 2]],
    "is_new_visitor": [[30]],
    "event = 'activated'": [[9]],
    "select count() from events where event in": [[9]],
    "'$exception'": [['TypeError: x is undefined', 3], ['api 503', 2]],
  };
  let calls = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls++;
    assert.match(String(url), /us\.posthog\.com\/api\/projects\/123\/query\//);
    assert.equal((init.headers as any).authorization, 'Bearer key');
    const q = JSON.parse(String(init.body)).query.query as string;
    assert.match(q, /owner_access is null/);
    const hit = Object.keys(answers).find((k) => q.includes(k))!;
    return json({ results: answers[hit] });
  }) as any;
  const out = await dailyReport(fetchImpl, { POSTHOG_PERSONAL_API_KEY: 'key', POSTHOG_PROJECT_ID: '123' });
  assert.equal(calls, 5);
  assert.match(out, /Visits: 52 \(organic_search 40, shared_link 10, unknown 2\)/);
  assert.match(out, /Activated \(3 votes in first session\): 9 of 30 new visitors \(30%\)/);
  assert.match(out, /Errors: 9 \(TypeError: x is undefined x3; api 503 x2\)/);
});

test('daily report with no events reports zeros, not NaN', async () => {
  const out = await dailyReport((async () => json({ results: [] })) as any, { POSTHOG_PERSONAL_API_KEY: 'k', POSTHOG_PROJECT_ID: '1' });
  assert.match(out, /Visits: 0/);
  assert.match(out, /0 of 0 new visitors \(n\/a\)/);
  assert.match(out, /Errors: none/);
});

test('daily report survives a PostHog failure', async () => {
  const out = await dailyReport((async () => json({}, 401)) as any, { POSTHOG_PERSONAL_API_KEY: 'k', POSTHOG_PROJECT_ID: '1' });
  assert.match(out, /PostHog query failed: us\.posthog\.com answered 401/);
});

test('seo report without credentials names both missing keys', async () => {
  const out = await seoReport((async () => { throw new Error('no network expected'); }) as any, {}, []);
  assert.match(out, /Google: not configured: GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(out, /Bing: not configured: BING_WEBMASTER_API_KEY/);
});

test('seo report summarises Google sitemap, indexed pages and queries, and Bing crawl stats', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'r@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com')) return json({ access_token: 'tok' });
    if (u.includes('/sitemaps')) return json({ sitemap: [{ path: 'https://www.wouldyourather.fyi/sitemap.xml', errors: 0, warnings: 0, lastDownloaded: '2026-11-17T10:00:00Z', contents: [{ submitted: 344 }] }] });
    if (u.includes('urlInspection')) return json({ inspectionResult: { indexStatusResult: { verdict: JSON.parse(String(init!.body)).inspectionUrl.endsWith('/a') ? 'PASS' : 'NEUTRAL' } } });
    if (u.includes('searchAnalytics')) return json({ rows: [{ keys: ['few impressions, many clicks'], impressions: 10, clicks: 9, position: 2 }, { keys: ['would you rather for kids'], impressions: 120, clicks: 4, position: 8.26 }] });
    if (u.includes('GetFeeds')) return json({ d: [{ Url: 'https://www.wouldyourather.fyi/sitemap.xml', Status: 'Success', UrlCount: 344 }] });
    if (u.includes('GetCrawlStats')) return json({ d: [{ InIndex: 10, CrawledPages: 30, CrawlErrors: 1 }, { InIndex: 12, CrawledPages: 33, CrawlErrors: 0 }] });
    if (u.includes('GetQueryStats')) return json({ d: [{ Query: 'wyr app', Impressions: 7, Clicks: 1, Date: `/Date(${Date.now() - 864e5})/` }] });
    throw new Error('unexpected ' + u);
  }) as any;
  const out = await seoReport(fetchImpl, { GSC_SERVICE_ACCOUNT_JSON: sa, BING_WEBMASTER_API_KEY: 'bk' }, ['https://x/a', 'https://x/b']);
  assert.match(out, /Google sitemaps: \/sitemap\.xml ok, 344 URLs submitted, last read 2026-11-17/);
  assert.match(out, /Google indexed \(inspected 2 key pages\): 1 indexed, 0 unknown/);
  assert.match(out, /top queries \(7d\): "would you rather for kids" 120 imp\/4 clk pos 8\.3; "few impressions, many clicks"/);
  assert.match(out, /Bing sitemaps: \/sitemap\.xml Success, 344 URLs/);
  assert.match(out, /Bing indexed pages: 12, crawled 33, crawl errors 0/);
  assert.match(out, /Bing top queries \(7d\): "wyr app" 7 imp\/1 clk/);
});

test('googleAccessToken signs a JWT and returns the access token', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'r@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  let assertion = '';
  const tok = await googleAccessToken((async (_u: string, init: RequestInit) => { assertion = (init.body as URLSearchParams).get('assertion')!; return json({ access_token: 'abc' }); }) as any, sa);
  assert.equal(tok, 'abc');
  assert.equal(assertion.split('.').length, 3);
});

test('daily errors total counts every error, not just the five listed groups', async () => {
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const q = JSON.parse(String(init.body)).query.query as string;
    if (q.includes("event in ('$exception'") && q.includes('limit 5')) return json({ results: [['a', 1], ['b', 1], ['c', 1], ['d', 1], ['e', 1]] });
    if (q.includes("event in ('$exception'")) return json({ results: [[6]] });
    return json({ results: [] });
  }) as any;
  const out = await dailyReport(fetchImpl, { POSTHOG_PERSONAL_API_KEY: 'k', POSTHOG_PROJECT_ID: '1' });
  assert.match(out, /Errors: 6 /);
});

test('topBingQueries keeps the last 7 days, sums repeats, ranks by impressions', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const d = (days: number) => `/Date(${now - days * 864e5})/`;
  const rows = [
    { Query: 'old', Impressions: 500, Clicks: 5, Date: d(20) },
    { Query: 'a', Impressions: 3, Clicks: 0, Date: d(1) },
    { Query: 'b', Impressions: 4, Clicks: 1, Date: d(2) },
    { Query: 'a', Impressions: 3, Clicks: 1, Date: d(3) },
    { Query: 'nodate', Impressions: 99, Clicks: 9 },
  ];
  assert.deepEqual(topBingQueries(rows, now), [
    { Query: 'a', Impressions: 6, Clicks: 1 },
    { Query: 'b', Impressions: 4, Clicks: 1 },
  ]);
  assert.equal(parseBingDate('/Date(1731888000000-0800)/'), 1731888000000);
  assert.equal(parseBingDate('2026-11-17T00:00:00Z'), Date.parse('2026-11-17T00:00:00Z'));
});
