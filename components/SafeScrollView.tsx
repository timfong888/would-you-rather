import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { insetPadding } from '@/lib/safeArea';

/**
 * ScrollView for screens with `headerShown: false` (#109). Without a native header nothing keeps
 * content out from under the status bar, notch or Dynamic Island, so the top and bottom insets are
 * added to the content padding here. Use this (or useSafeAreaInsets) on every headerless route;
 * tests/unit/safe-area.test.ts enforces it. Never use a fixed top offset instead.
 */
export default function SafeScrollView({ contentContainerStyle, ...rest }: ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const extra = insetPadding(StyleSheet.flatten(contentContainerStyle) as object, insets);
  return <ScrollView {...rest} contentContainerStyle={extra ? [contentContainerStyle, extra] : contentContainerStyle} />;
}
