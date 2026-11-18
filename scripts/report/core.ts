/**
 * Daily and weekly reports (#82). Plain functions with an injected `fetch` so they can be
 * tested with fixture responses; the CLI is scripts/report.ts. No dependencies beyond Node.
 * A missing credential never throws: that section prints "not configured: <KEY>".
 */
import { createSign } from 'node:crypto';

export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

export const SITE = 'https://www.wouldyourather.fyi';
export const GSC_SITE_DEFAULT = 'sc-domain:wouldyourather.fyi';

const missing = (...keys: string[]) => `not configured: ${keys.join(', ')}`;
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : 'n/a');

async function getJson(fetchImpl: Fetch, url: string, init?: RequestInit): Promise<any> {
  const res = await fetchImpl(url, init);
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

// ── PostHog (daily) ─────────────────────────────────────────────────────────

export async function hogql(fetchImpl: Fetch, env: Env, query: string): Promise<any[][]> {
  const data = await getJson(
    fetchImpl,
    `https://us.posthog.com/api/projects/${env.POSTHOG_PROJECT_ID}/query/`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    },
  );
  return data.results ?? [];
}

const NOT_OWNER = `properties.owner_access is null`;
const SINCE = `timestamp > now() - interval 1 day`;

export async function dailyReport(fetchImpl: Fetch, env: Env): Promise<string> {
  const lines = ['WYR daily (last 24h, owner traffic excluded)'];
  if (!env.POSTHOG_PERSONAL_API_KEY || !env.POSTHOG_PROJECT_ID) {
    lines.push(`Visits, activation, errors: ${missing('POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID')}`);
    return lines.join('\n');
  }
  try {
    const [bySource, newVisitors, activated, errors] = await Promise.all([
      hogql(fetchImpl, env, `select properties.channel, count() from events where event = 'session_start' and ${SINCE} and ${NOT_OWNER} group by 1 order by 2 desc`),
      hogql(fetchImpl, env, `select count() from events where event = 'session_start' and properties.is_new_visitor = true and ${SINCE} and ${NOT_OWNER}`),
      hogql(fetchImpl, env, `select count() from events where event = 'activated' and ${SINCE} and ${NOT_OWNER}`),
      hogql(fetchImpl, env, `select coalesce(properties.$exception_message, properties.message, event), count() from events where event in ('$exception', 'api_error') and ${SINCE} and ${NOT_OWNER} group by 1 order by 2 desc limit 5`),
    ]);
    const visits = bySource.reduce((n, r) => n + Number(r[1]), 0);
    lines.push(`Visits: ${visits}` + (bySource.length ? ` (${bySource.map((r) => `${r[0] ?? 'unknown'} ${r[1]}`).join(', ')})` : ''));
    const nv = Number(newVisitors[0]?.[0] ?? 0);
    const act = Number(activated[0]?.[0] ?? 0);
    lines.push(`Activated (3 votes in first session): ${act} of ${nv} new visitors (${pct(act, nv)})`);
    const total = errors.reduce((n, r) => n + Number(r[1]), 0);
    lines.push(total === 0 ? 'Errors: none' : `Errors: ${total} (${errors.map((r) => `${String(r[0]).slice(0, 60)} x${r[1]}`).join('; ')})`);
  } catch (e) {
    lines.push(`PostHog query failed: ${(e as Error).message}`);
  }
  return lines.join('\n');
}

// ── Google Search Console (weekly) ──────────────────────────────────────────

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export async function googleAccessToken(fetchImpl: Fetch, serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3000,
  };
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claim))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key);
  const data = await getJson(fetchImpl, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  return data.access_token;
}

export async function googleSection(fetchImpl: Fetch, env: Env, urls: string[]): Promise<string[]> {
  if (!env.GSC_SERVICE_ACCOUNT_JSON) return [`Google: ${missing('GSC_SERVICE_ACCOUNT_JSON')}`];
  const site = env.GSC_SITE_URL || GSC_SITE_DEFAULT;
  const enc = encodeURIComponent(site);
  const out: string[] = [];
  try {
    const token = await googleAccessToken(fetchImpl, env.GSC_SERVICE_ACCOUNT_JSON);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const maps = await getJson(fetchImpl, `https://www.googleapis.com/webmasters/v3/sites/${enc}/sitemaps`, { headers: auth });
    const list = maps.sitemap ?? [];
    out.push(list.length === 0 ? 'Google sitemaps: none submitted' : 'Google sitemaps: ' + list.map((s: any) => {
      const submitted = (s.contents ?? []).reduce((n: number, c: any) => n + Number(c.submitted ?? 0), 0);
      const state = s.errors > 0 ? `${s.errors} errors` : s.warnings > 0 ? `${s.warnings} warnings` : s.isPending ? 'pending' : 'ok';
      return `${s.path.replace(SITE, '')} ${state}, ${submitted} URLs submitted, last read ${String(s.lastDownloaded ?? 'never').slice(0, 10)}`;
    }).join('; '));

    // The sitemaps API no longer reports an indexed count, so inspect the pages that matter.
    const verdicts = await Promise.all(urls.map(async (u) => {
      try {
        const r = await getJson(fetchImpl, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          method: 'POST', headers: auth, body: JSON.stringify({ inspectionUrl: u, siteUrl: site }),
        });
        return r.inspectionResult?.indexStatusResult?.verdict as string | undefined;
      } catch { return undefined; }
    }));
    const indexed = verdicts.filter((v) => v === 'PASS').length;
    out.push(`Google indexed (inspected ${urls.length} key pages): ${indexed} indexed, ${verdicts.filter((v) => v === undefined).length} unknown`);

    const end = new Date(); const start = new Date(end.getTime() - 7 * 864e5);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const q = await getJson(fetchImpl, `https://www.googleapis.com/webmasters/v3/sites/${enc}/searchAnalytics/query`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ startDate: day(start), endDate: day(end), dimensions: ['query'], rowLimit: 5 }),
    });
    const rows = q.rows ?? [];
    out.push(rows.length === 0 ? 'Google top queries (7d): no impressions yet' : 'Google top queries (7d): ' + rows.map((r: any) => `"${r.keys[0]}" ${r.impressions} imp/${r.clicks} clk pos ${Number(r.position).toFixed(1)}`).join('; '));
  } catch (e) {
    out.push(`Google failed: ${(e as Error).message}`);
  }
  return out;
}

// ── Bing Webmaster (weekly) ─────────────────────────────────────────────────

export async function bingSection(fetchImpl: Fetch, env: Env): Promise<string[]> {
  if (!env.BING_WEBMASTER_API_KEY) return [`Bing: ${missing('BING_WEBMASTER_API_KEY')}`];
  const base = 'https://ssl.bing.com/webmaster/api.svc/json';
  const qs = `siteUrl=${encodeURIComponent(SITE)}&apikey=${encodeURIComponent(env.BING_WEBMASTER_API_KEY)}`;
  const out: string[] = [];
  try {
    const feeds = (await getJson(fetchImpl, `${base}/GetFeeds?${qs}`)).d ?? [];
    out.push(feeds.length === 0 ? 'Bing sitemaps: none submitted' : 'Bing sitemaps: ' + feeds.map((f: any) => `${String(f.Url).replace(SITE, '')} ${f.Status ?? 'unknown'}, ${f.UrlCount ?? '?'} URLs`).join('; '));
    const stats = (await getJson(fetchImpl, `${base}/GetCrawlStats?${qs}`)).d ?? [];
    const latest = stats[stats.length - 1];
    out.push(latest ? `Bing indexed pages: ${latest.InIndex}, crawled ${latest.CrawledPages}, crawl errors ${latest.CrawlErrors}` : 'Bing indexed pages: no crawl data yet');
    const queries = ((await getJson(fetchImpl, `${base}/GetQueryStats?${qs}`)).d ?? []).slice(0, 5);
    out.push(queries.length === 0 ? 'Bing top queries: none yet' : 'Bing top queries: ' + queries.map((r: any) => `"${r.Query}" ${r.Impressions} imp/${r.Clicks} clk`).join('; '));
  } catch (e) {
    out.push(`Bing failed: ${(e as Error).message}`);
  }
  return out;
}

export async function seoReport(fetchImpl: Fetch, env: Env, keyUrls: string[]): Promise<string> {
  const lines = ['WYR weekly SEO', ...(await googleSection(fetchImpl, env, keyUrls)), ...(await bingSection(fetchImpl, env))];
  return lines.join('\n');
}
