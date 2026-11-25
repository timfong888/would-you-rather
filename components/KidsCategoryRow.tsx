import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import { getFreeQuestionCount, getLockedQuestionCount, type CategoryDef } from '@/constants/questions';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { formatAges, freeMoreHint } from '@/lib/browse';

/** A With kids category card: emoji, name, age range, and "5 free · N more" (no price, so it fits any unlock model). */
export default function KidsCategoryRow({ category, onPress }: { category: CategoryDef; onPress: () => void }) {
  const { styles } = useThemedStyles(makeStyles);
  const ages = formatAges(category);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${category.label}, ${ages ?? ''}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.icon, { backgroundColor: category.color }]}>
        <Text style={styles.emoji}>{category.emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name}>{category.label.toUpperCase()}</Text>
        {ages ? <Text style={styles.ages}>{ages}</Text> : null}
        <Text style={styles.hint}>{freeMoreHint(getFreeQuestionCount(category), getLockedQuestionCount(category))}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    icon: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 24 },
    text: { flex: 1, gap: 2 },
    name: { color: colors.text, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.extrabold, letterSpacing: 1 },
    ages: { color: colors.magenta, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    hint: { color: colors.textMuted, fontSize: FONTS.sizes.xs },
    chevron: { color: colors.textMuted, fontSize: FONTS.sizes.xl },
  });
}
