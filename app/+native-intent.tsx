// Native only (Expo Router ignores this file on the web). Maps incoming links, such as a tapped
// Universal Link https://www.wouldyourather.fyi/p/<id>, to an app route (#134).
import { getQuestionById } from '@/constants/questions';
import { nativePathFor } from '@/lib/universalLink';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return nativePathFor(path, getQuestionById);
  } catch {
    return path;
  }
}
