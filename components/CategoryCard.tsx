import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import type { CategoryDef } from '@/constants/questions';
import { FREE_TRIAL_COUNT } from '@/constants/questions';

interface CategoryCardProps {
  category: CategoryDef;
  questionCount: number;
  onPress: () => void;
  variant?: 'grid' | 'row';
}

export default function CategoryCard({
  category,
  questionCount,
  onPress,
  variant = 'grid',
}: CategoryCardProps) {
  const isPremium = category.tier === 'premium';

  if (variant === 'row') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowContainer,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${category.color}20`, borderColor: `${category.color}40` }]}>
          <Text style={styles.rowEmoji}>{category.emoji}</Text>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{category.label.toUpperCase()}</Text>
          <Text style={styles.rowCount}>{questionCount} questions</Text>
        </View>
        <View style={styles.rowRight}>
          {isPremium ? (
            <View style={styles.premiumPill}>
              <Text style={styles.premiumPillText}>👑 PREMIUM</Text>
            </View>
          ) : (
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>✓ FREE</Text>
            </View>
          )}
          <Text style={styles.chevron}>›</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridContainer,
        { borderColor: `${category.color}40`, backgroundColor: `${category.color}12` },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.gridEmoji}>{category.emoji}</Text>
      <Text style={[styles.gridLabel, { color: category.color }]}>
        {category.label.toUpperCase()}
      </Text>
      <Text style={styles.gridCount}>{questionCount} questions</Text>
      {isPremium ? (
        <View style={styles.premiumPill}>
          <Text style={styles.premiumPillText}>👑 PREMIUM</Text>
        </View>
      ) : (
        <View style={styles.freePill}>
          <Text style={styles.freePillText}>✓ FREE</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Grid variant
  gridContainer: {
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  gridEmoji: {
    fontSize: 28,
  },
  gridLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  gridCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
  },

  // Row variant
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  rowIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowEmoji: {
    fontSize: 26,
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1,
  },
  rowCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },

  // Shared
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  premiumPill: {
    backgroundColor: COLORS.premiumBg,
    borderWidth: 1,
    borderColor: COLORS.premium,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  premiumPillText: {
    color: COLORS.premium,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  freePill: {
    backgroundColor: COLORS.freeBg,
    borderWidth: 1,
    borderColor: COLORS.free,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  freePillText: {
    color: COLORS.free,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
});
