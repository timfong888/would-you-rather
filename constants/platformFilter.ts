/**
 * Default (web, scripts): every category is available, unless the iOS v1
 * catalog is requested explicitly, which the store screenshot run does:
 *   EXPO_PUBLIC_IOS_V1_CATALOG=1 npx expo start --web
 * Metro picks constants/platformFilter.ios.ts on iOS, which always filters.
 */
import { IOS_V1_EXCLUDED_CATEGORIES } from './iosV1';

const iosV1 = process.env.EXPO_PUBLIC_IOS_V1_CATALOG === '1';

export function isCategoryAvailable(id: string): boolean {
  return !(iosV1 && IOS_V1_EXCLUDED_CATEGORIES.includes(id));
}
