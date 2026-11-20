// The iOS app on the App Store (#134). Plain JS (with appStore.d.ts) so the app and the build
// scripts (scripts/generate-sharing-pages.mjs, scripts/inject-smart-banner.mjs) share it.

export const APP_STORE_ID = '6836653723';

// "Get the app" stays hidden until the app is public (TestFlight only for now). Turn it on by
// setting EXPO_PUBLIC_APP_STORE_LIVE=true in Vercel (Production and Preview), or flip the default.
export const APP_STORE_LIVE = process.env.EXPO_PUBLIC_APP_STORE_LIVE === 'true';

// App Store Connect provider token (the `pt` of a campaign link; App Analytics > Campaigns >
// Generate a campaign link shows it). Without it the link still opens the App Store, but
// App Store Connect cannot report installs by campaign. Not an ID of any user.
export const APP_STORE_PROVIDER_TOKEN = process.env.EXPO_PUBLIC_APP_STORE_PROVIDER_TOKEN ?? '';

/**
 * App Store link with Apple campaign parameters, so App Store Connect counts installs by source.
 * Kids items use their own campaign name: that count, kept by Apple, is all we learn (no IDs).
 */
export function appStoreUrl({ campaign, providerToken = APP_STORE_PROVIDER_TOKEN }) {
  const params = new URLSearchParams();
  if (providerToken) params.set('pt', providerToken);
  params.set('ct', campaign);
  params.set('mt', '8');
  return `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?${params.toString()}`;
}

/** Campaign name for a share-link arrival. */
export function shareCampaign(kids) {
  return kids ? 'share_p_kids' : 'share_p';
}

/**
 * Content of the Smart App Banner meta (<meta name="apple-itunes-app">). Safari shows the banner
 * only when the app is on the store in the viewer's country, so this is safe before release.
 * `appArgument` is the URL the app receives when opened from the banner.
 */
export function smartBannerContent(appArgument) {
  return appArgument ? `app-id=${APP_STORE_ID}, app-argument=${appArgument}` : `app-id=${APP_STORE_ID}`;
}

/** True for an iPhone web browser (where an App Store link can install the app). */
export function isIphoneBrowser(userAgent) {
  return typeof userAgent === 'string' && /iPhone|iPod/.test(userAgent);
}

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Add the Smart App Banner meta to an HTML page (no-op if it has one). A share page passes
 * `isSharePage`, and its og:url becomes the app-argument.
 */
export function addSmartBanner(html, isSharePage = false) {
  if (html.includes('name="apple-itunes-app"')) return html;
  let arg;
  if (isSharePage) {
    const m = html.match(/<meta property="og:url"\s+content="([^"]+)"/);
    if (!m) throw new Error('addSmartBanner: share page without og:url');
    arg = m[1].replace(/&amp;/g, '&');
  }
  if (!html.includes('</head>')) throw new Error('addSmartBanner: no </head>');
  const tag = `<meta name="apple-itunes-app" content="${escAttr(smartBannerContent(arg))}" />`;
  return html.replace('</head>', `${tag}</head>`);
}
