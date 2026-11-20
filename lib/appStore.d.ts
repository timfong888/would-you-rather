export const APP_STORE_ID: string;
export const APP_STORE_LIVE: boolean;
export const APP_STORE_PROVIDER_TOKEN: string;
export function appStoreUrl(o: { campaign: string; providerToken?: string }): string;
export function shareCampaign(kids: boolean): string;
export function smartBannerContent(appArgument?: string): string;
export function isIphoneBrowser(userAgent: unknown): boolean;
export function addSmartBanner(html: string): string;
