import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { KIDS_BROWSE_PATH } from '@/lib/kidsPaths';
import type { BrowseMode } from '@/lib/browse';

/**
 * Grown-ups | With kids (spec §2.1). The mode is the route: Grown-ups is the home screen and /categories, With kids is
 * /kids, which is a kids route (nothing tracked, nothing stored). Tapping sends no analytics event of its own.
 */
export default function ModeSwitch({ mode }: { mode: BrowseMode }) {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const options: { id: BrowseMode; label: string; go: () => void }[] = [
    { id: 'grownups', label: 'Grown-ups', go: () => router.replace('/') },
    { id: 'kids', label: 'With kids', go: () => router.push(KIDS_BROWSE_PATH) },
  ];
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.id === mode;
        return (
          <Pressable
            key={o.id}
            onPress={selected ? undefined : o.go}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginBottom: SPACING.md,
    },
    option: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.full,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    optionSelected: { backgroundColor: colors.magenta },
    optionText: { color: colors.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    optionTextSelected: { color: colors.textOnColor },
  });
}
