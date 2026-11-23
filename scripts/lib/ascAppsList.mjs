// Pure helpers for scripts/asc-apps-list.mjs: read-only listing of every app in an ASC account.
// Nothing here talks to the network on its own; the caller passes in `get(path)` (GET only).

const NEVILLE = /neville/i;

// Replace every secret value (and anything shaped like a JWT or PEM key) with ***.
export function makeRedactor(secrets) {
  const literals = secrets
    .map((s) => (s ?? '').toString())
    .flatMap((s) => [s, s.replace(/\\n/g, '\n'), s.replace(/\r?\n/g, '\\n')])
    .filter((s) => s.length >= 4)
    .sort((a, b) => b.length - a.length);
  return (text) => {
    let out = String(text);
    for (const s of literals) out = out.split(s).join('***');
    out = out.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '***');
    out = out.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '***');
    return out;
  };
}

const API = 'https://api.appstoreconnect.apple.com';
const rel = (link) => (link ? link.replace(API, '') : null);

// Follow links.next. Throws if the list cannot be completed, so a partial list is never shown as whole.
export async function getAll(get, path, maxPages = 50) {
  const data = [];
  const included = [];
  let next = path;
  for (let page = 0; next && page < maxPages; page++) {
    const r = await get(next);
    if (r.status !== 200) throw new Error(`GET ${path.split('?')[0]} failed: HTTP ${r.status} ${summarizeErrors(r.body)}`);
    data.push(...(r.body.data ?? []));
    included.push(...(r.body.included ?? []));
    next = rel(r.body.links?.next);
  }
  if (next) throw new Error(`GET ${path.split('?')[0]}: more than ${maxPages} pages, refusing to show a partial list`);
  return { data, included };
}

export function summarizeErrors(body) {
  const errs = body?.errors;
  if (!Array.isArray(errs) || !errs.length) return '';
  return errs.map((e) => `${e.code ?? ''} ${e.title ?? ''}`.trim()).join('; ');
}

export async function listApps(get) {
  const { data, included } = await getAll(
    get,
    '/v1/apps?limit=200&include=appStoreVersions' +
      '&fields[apps]=name,bundleId,sku,appStoreVersions' +
      '&fields[appStoreVersions]=platform,appStoreState,versionString&limit[appStoreVersions]=50',
  );
  const versions = new Map(included.filter((i) => i.type === 'appStoreVersions').map((v) => [v.id, v.attributes ?? {}]));
  return data.map((a) => {
    const vs = (a.relationships?.appStoreVersions?.data ?? []).map((ref) => versions.get(ref.id)).filter(Boolean);
    return {
      id: a.id,
      name: a.attributes?.name ?? '',
      bundleId: a.attributes?.bundleId ?? '',
      platforms: [...new Set(vs.map((v) => v.platform).filter(Boolean))],
      states: [...new Set(vs.map((v) => `${v.platform ?? '?'} ${v.versionString ?? ''}: ${v.appStoreState ?? '?'}`.replace('  ', ' ')))],
    };
  });
}

export async function latestBuild(get, appId) {
  const { data } = await (async () => {
    const r = await get(
      `/v1/builds?filter[app]=${encodeURIComponent(appId)}&sort=-uploadedDate&limit=1` +
        '&fields[builds]=version,uploadedDate,processingState,expired',
    );
    if (r.status !== 200) throw new Error(`GET /v1/builds failed for app ${appId}: HTTP ${r.status} ${summarizeErrors(r.body)}`);
    return { data: r.body.data ?? [] };
  })();
  const b = data[0]?.attributes;
  if (!b) return { number: '', state: '', uploaded: '' };
  return { number: b.version ?? '', state: b.expired ? `${b.processingState} (expired)` : (b.processingState ?? ''), uploaded: b.uploadedDate ?? '' };
}

export const isNeville = (app) => NEVILLE.test(app.name) || NEVILLE.test(app.bundleId);

export function compileMatch(input) {
  const src = input === undefined || input === '' ? '.' : input;
  try { return new RegExp(src, 'i'); } catch (e) { throw new Error(`Invalid match regexp: ${e.message}`); }
}

export async function buildRows(get, { match = '.' } = {}) {
  const re = compileMatch(match);
  const apps = (await listApps(get)).filter((a) => re.test(a.name) || re.test(a.bundleId));
  const rows = [];
  for (const a of apps) {
    const b = await latestBuild(get, a.id);
    rows.push({
      name: a.name,
      bundleId: a.bundleId,
      appleAppId: a.id,
      platform: a.platforms.join(', ') || '-',
      appStoreState: a.states.join('; ') || '-',
      buildNumber: b.number || '-',
      buildState: b.state || '-',
      buildUploaded: b.uploaded || '-',
      neville: isNeville(a),
    });
  }
  return rows;
}

const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');

export function toMarkdown(rows, { match = '.', total } = {}) {
  const lines = [
    '## App Store Connect apps (read only)',
    '',
    `Apps shown: ${rows.length}${total !== undefined && total !== rows.length ? ` of ${total}` : ''}. Filter: \`${cell(match)}\`.`,
    `Apple team: not exposed by the App Store Connect API for a team key, so check the account in App Store Connect.`,
    '',
    '| Flag | Name | Bundle ID | Apple app ID | Platform | App Store state | Latest build | Build state |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    lines.push(`| ${r.neville ? 'NEVILLE' : ''} | ${cell(r.name)} | ${cell(r.bundleId)} | ${cell(r.appleAppId)} | ${cell(r.platform)} | ${cell(r.appStoreState)} | ${cell(r.buildNumber)} | ${cell(r.buildState)} |`);
  }
  if (!rows.length) lines.push('| | (no apps matched) | | | | | | |');
  return lines.join('\n') + '\n';
}
