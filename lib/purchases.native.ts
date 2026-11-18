/**
 * iOS / Android implementation on top of react-native-purchases. The logic
 * lives in purchases-core.ts (unit-tested with a fake SDK); this file only
 * binds the real SDK and the public key for the platform.
 *
 * Key per stage (public SDK keys, safe in the client):
 *   development  test_...   RevenueCat Test Store
 *   preview      appl_... / goog_...   store sandbox
 *   production   appl_... / goog_...   real purchases
 * iOS reads EXPO_PUBLIC_RC_IOS_KEY, Android EXPO_PUBLIC_RC_ANDROID_KEY.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { createPurchases } from './purchases-core';
import type { SdkLike } from './purchases-core';

export type { PurchasesApi, PurchaseResult } from './purchases.types';

const API_KEY =
  Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

if (__DEV__ && API_KEY) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

export const purchases = createPurchases(Purchases as unknown as SdkLike, API_KEY);
