import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AGE_BANDS } from '@/lib/browse';

/** Age filter for With kids mode. The choice is the parent's component state: nothing is stored or sent. */
export default function AgeChips({ selected, onSelect }: { selected: string; onSelect: (bandId: string) => void }) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Age">
      {AGE_BANDS.map((b) => {
        const on = b.id === selected;
        return (
          <Pressable
            key={b.id}
            onPress={() => onSelect(b.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={b.ages ? `Ages ${b.label}` : 'All ages'}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && !on && { opacity: 0.7 }]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'center' },
    chip: {
      minWidth: 56,
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    chipTextOn: { color: colors.textOnColor },
  });
}
