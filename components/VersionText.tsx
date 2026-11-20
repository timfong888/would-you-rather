import { Platform, Text, type StyleProp, type TextStyle } from 'react-native';
import * as Application from 'expo-application';
import { formatVersion } from '@/lib/version';

/**
 * "Version 1.0.0 (8)": the version and build number of the installed iOS/Android binary (#119).
 * Renders nothing on web, where there is no installed build; the web page is unchanged.
 */
export default function VersionText({ style }: { style?: StyleProp<TextStyle> }) {
  if (Platform.OS === 'web') return null;
  return <Text style={style}>{formatVersion(Application.nativeApplicationVersion, Application.nativeBuildVersion)}</Text>;
}
