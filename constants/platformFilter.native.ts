/**
 * Native builds (iOS and Android): the v1 catalog always applies, so every category
 * shown has a purchasable product. Metro picks this file for both. See constants/iosV1.ts.
 */
import { IOS_V1_EXCLUDED_CATEGORIES } from './iosV1';

export function isCategoryAvailable(id: string): boolean {
  return !IOS_V1_EXCLUDED_CATEGORIES.includes(id);
}
