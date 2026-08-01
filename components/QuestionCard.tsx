import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import type { Question } from '@/constants/questions';
import { CATEGORIES } from '@/constants/questions';

interface QuestionCardProps {
  question: Question;
  compact?: boolean;
}

export default function QuestionCard({ question, compact = false }: QuestionCardProps) {
  const router = useRouter();
  const category = CATEGORIES.find((c) => c.id === question.category);

  return (
    <Pressable
      onPress={() => router.push(`/game/${question.id}`)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      {category && (
        <View style={[styles.categoryBadge, { backgroundColor: `${category.color}20` }]}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: category.color }]}>
            {category.label}
          </Text>
        </View>
      )}

      {!compact && (
        <Text style={styles.wyr}>Would you rather...</Text>
      )}

      <View style={styles.options}>
        <View style={[styles.optionChip, { backgroundColor: `${COLORS.optionA}20`, borderColor: `${COLORS.optionA}40` }]}>
          <View style={[styles.optionBadge, { backgroundColor: COLORS.optionA }]}>
            <Text style={styles.optionBadgeText}>A</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {question.optionA}
          </Text>
        </View>

        <Text style={styles.or}>OR</Text>

        <View style={[styles.optionChip, { backgroundColor: `${COLORS.optionB}20`, borderColor: `${COLORS.optionB}40` }]}>
          <View style={[styles.optionBadge, { backgroundColor: COLORS.optionB }]}>
            <Text style={styles.optionBadgeText}>B</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {question.optionB}
          </Text>
        </View>
      </View>

    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      },
    }),
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wyr: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontStyle: 'italic',
  },
  options: {
    gap: SPACING.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  optionBadge: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBadgeText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  optionText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    flex: 1,
    lineHeight: 18,
  },
  or: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
    letterSpacing: 2,
  },
});
