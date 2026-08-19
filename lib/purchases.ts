import { Platform } from 'react-native';

const ENTITLEMENT_ID = 'premium_pack';
const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUE_CAT_DEV_KEY ?? '';

function isNativeWithKey(): boolean {
  return Platform.OS !== 'web' && RC_API_KEY.length > 0;
}

export async function configurePurchases(): Promise<void> {
  if (!isNativeWithKey()) return;
  const { default: Purchases } = await import('react-native-purchases');
  Purchases.configure({ apiKey: RC_API_KEY });
}

export async function hasPremiumEntitlement(): Promise<boolean> {
  if (!isNativeWithKey()) return false;
  try {
    const { default: Purchases } = await import('react-native-purchases');
    const info = await Purchases.getCustomerInfo();
    return ENTITLEMENT_ID in info.entitlements.active;
  } catch {
    return false;
  }
}

export async function purchasePremiumPack(): Promise<boolean> {
  if (!isNativeWithKey()) return false;
  const { default: Purchases } = await import('react-native-purchases');
  const offerings = await Purchases.getOfferings();
  const pkg =
    offerings.current?.availablePackages[0] ??
    offerings.all[Object.keys(offerings.all)[0]]?.availablePackages[0];
  if (!pkg) throw new Error('No RevenueCat package found — check dashboard configuration');
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return ENTITLEMENT_ID in customerInfo.entitlements.active;
}

export async function restoreRevenueCatPurchases(): Promise<boolean> {
  if (!isNativeWithKey()) return false;
  const { default: Purchases } = await import('react-native-purchases');
  const info = await Purchases.restorePurchases();
  return ENTITLEMENT_ID in info.entitlements.active;
}
