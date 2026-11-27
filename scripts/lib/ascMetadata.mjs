// Pure logic for pushing listing TEXT to App Store Connect. No network, no secrets here.
// It can only touch localizations and the copyright field; there is no code path for
// builds, screenshots, pricing, age rating or submission (see ALLOWED below, enforced in tests).

export const LIMITS = { name: 30, subtitle: 30, promotionalText: 170, keywords: 100, description: 4000, whatsNew: 4000, copyright: 200 };

/** Every API call the tool may make: [method, path pattern]. Anything else throws. */
export const ALLOWED = [
  ['GET', /^\/v1\/apps\/\d+\/appInfos$/],
  ['GET', /^\/v1\/appInfos\/[\w-]+\/appInfoLocalizations$/],
  ['PATCH', /^\/v1\/appInfoLocalizations\/[\w-]+$/],
  ['POST', /^\/v1\/appInfoLocalizations$/],
  ['GET', /^\/v1\/apps\/\d+\/appStoreVersions$/],
  ['PATCH', /^\/v1\/appStoreVersions\/[\w-]+$/],
  ['GET', /^\/v1\/appStoreVersions\/[\w-]+\/appStoreVersionLocalizations$/],
  ['PATCH', /^\/v1\/appStoreVersionLocalizations\/[\w-]+$/],
  ['POST', /^\/v1\/appStoreVersionLocalizations$/],
];

/** Versions whose text Apple still lets us edit. Anything in review or released is refused. */
export const EDITABLE_STATES = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];

export function validateListing(l) {
  const errors = [];
  const len = (v) => [...String(v)].length;
  const need = (obj, key, where, max) => {
    const v = obj?.[key];
    if (typeof v !== 'string' || !v.trim()) { errors.push(`${where}.${key} is required`); return; }
    if (max && len(v) > max) errors.push(`${where}.${key} is ${len(v)} chars, limit ${max}`);
  };
  if (!l || typeof l !== 'object') return ['listing is not an object'];
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(l.locale ?? '')) errors.push('locale must look like en-US');
  need(l.appInfo, 'name', 'appInfo', LIMITS.name);
  need(l.appInfo, 'subtitle', 'appInfo', LIMITS.subtitle);
  need(l.appInfo, 'privacyPolicyUrl', 'appInfo');
  need(l.version, 'description', 'version', LIMITS.description);
  // keywords is optional (null = pending, skip write); if present it must be within limits
  if (l.version?.keywords != null) need(l.version, 'keywords', 'version', LIMITS.keywords);
  need(l.version, 'promotionalText', 'version', LIMITS.promotionalText);
  need(l.version, 'supportUrl', 'version');
  need(l.version, 'marketingUrl', 'version');
  need(l.version, 'copyright', 'version', LIMITS.copyright);
  if (l.version?.whatsNew != null) need(l.version, 'whatsNew', 'version', LIMITS.whatsNew);
  for (const [w, k] of [['appInfo', 'privacyPolicyUrl'], ['version', 'supportUrl'], ['version', 'marketingUrl']]) {
    const v = l[w]?.[k];
    if (typeof v === 'string' && !/^https:\/\/[^\s]+$/.test(v)) errors.push(`${w}.${k} must be an https URL`);
  }
  // Apple reserves "kids" wording in name, subtitle and keywords for the Kids Category (guideline 2.3.8).
  for (const [w, k] of [['appInfo', 'name'], ['appInfo', 'subtitle'], ['version', 'keywords']]) {
    if (/\bkids?\b|\bchildren\b/i.test(l[w]?.[k] ?? '')) errors.push(`${w}.${k} must not use "kids" or "children" (app is not in the Kids Category)`);
  }
  return errors;
}

function checked(api) {
  return async (method, path, body) => {
    if (!ALLOWED.some(([m, re]) => m === method && re.test(path.split('?')[0]))) {
      throw new Error(`Blocked: ${method} ${path} is not an allowed metadata call`);
    }
    return api(method, path, body);
  };
}

const diff = (current, wanted) => {
  const out = {};
  for (const [k, v] of Object.entries(wanted)) if (v !== undefined && (current?.[k] ?? null) !== v) out[k] = v;
  return out;
};

/**
 * Compare the listing with App Store Connect and, if apply is true, write the differences.
 * Two phases: (1) read everything and verify BOTH the app info and the iOS version are editable,
 * building a list of writes; (2) only then perform the writes. So a refusal never leaves a
 * partial update behind.
 * `api(method, path, body)` returns parsed JSON:API and throws on HTTP errors.
 * Returns the list of planned or performed changes, never secrets.
 */
export async function syncListing({ api, appId, listing, apply }) {
  const call = checked(api);
  const log = [];
  const writes = []; // [method, path, body]
  const loc = listing.locale;
  const v = listing.version;

  // Phase 1a: app-level text (appInfoLocalizations).
  const infos = (await call('GET', `/v1/apps/${appId}/appInfos`)).data ?? [];
  const info = infos.find((i) => EDITABLE_STATES.includes(i.attributes?.appStoreState));
  if (!info) throw new Error(`No editable appInfo (states: ${infos.map((i) => i.attributes?.appStoreState).join(', ') || 'none'})`);
  const infoLocs = (await call('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data ?? [];
  const infoLoc = infoLocs.find((x) => x.attributes?.locale === loc);
  const infoWanted = { name: listing.appInfo.name, subtitle: listing.appInfo.subtitle, privacyPolicyUrl: listing.appInfo.privacyPolicyUrl };
  if (!infoLoc) {
    log.push({ target: 'appInfoLocalization', action: 'create', locale: loc, fields: Object.keys(infoWanted) });
    writes.push(['POST', '/v1/appInfoLocalizations', { data: { type: 'appInfoLocalizations', attributes: { locale: loc, ...infoWanted }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } } }]);
  } else {
    const d = diff(infoLoc.attributes, infoWanted);
    if (Object.keys(d).length) {
      log.push({ target: 'appInfoLocalization', action: 'update', locale: loc, fields: Object.keys(d) });
      writes.push(['PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, { data: { type: 'appInfoLocalizations', id: infoLoc.id, attributes: d } }]);
    }
  }

  // Phase 1b: version-level text (appStoreVersionLocalizations) and copyright (appStoreVersions).
  const versions = (await call('GET', `/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&limit=10`)).data ?? [];
  const ver = versions.find((x) => EDITABLE_STATES.includes(x.attributes?.appStoreState));
  if (!ver) throw new Error(`No editable iOS version (states: ${versions.map((x) => x.attributes?.appStoreState).join(', ') || 'none'})`);
  const dv = diff(ver.attributes, { copyright: v.copyright });
  if (Object.keys(dv).length) {
    log.push({ target: 'appStoreVersion', action: 'update', version: ver.attributes?.versionString, fields: Object.keys(dv) });
    writes.push(['PATCH', `/v1/appStoreVersions/${ver.id}`, { data: { type: 'appStoreVersions', id: ver.id, attributes: dv } }]);
  }
  const verLocs = (await call('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data ?? [];
  const verLoc = verLocs.find((x) => x.attributes?.locale === loc);
  // keywords: null means "pending" — skip the field entirely so the current live value is not overwritten.
  const verWanted = { description: v.description, ...(v.keywords != null ? { keywords: v.keywords } : {}), promotionalText: v.promotionalText, supportUrl: v.supportUrl, marketingUrl: v.marketingUrl, ...(v.whatsNew != null ? { whatsNew: v.whatsNew } : {}) };
  if (!verLoc) {
    log.push({ target: 'appStoreVersionLocalization', action: 'create', locale: loc, fields: Object.keys(verWanted) });
    writes.push(['POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale: loc, ...verWanted }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } }]);
  } else {
    const d = diff(verLoc.attributes, verWanted);
    if (Object.keys(d).length) {
      log.push({ target: 'appStoreVersionLocalization', action: 'update', locale: loc, fields: Object.keys(d) });
      writes.push(['PATCH', `/v1/appStoreVersionLocalizations/${verLoc.id}`, { data: { type: 'appStoreVersionLocalizations', id: verLoc.id, attributes: d } }]);
    }
  }

  // Phase 2: writes, only after every check above passed.
  if (apply) for (const [method, path, body] of writes) await call(method, path, body);
  return log;
}
