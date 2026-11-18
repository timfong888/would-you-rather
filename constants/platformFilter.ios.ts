/** iOS build: the iOS v1 catalog always applies. See constants/iosV1.ts. */
import { IOS_V1_EXCLUDED_CATEGORIES } from './iosV1';

export function isCategoryAvailable(id: string): boolean {
  return !IOS_V1_EXCLUDED_CATEGORIES.includes(id);
}
