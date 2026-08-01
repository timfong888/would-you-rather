import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import type { Question } from '@/constants/questions';
import { CATEGORIES } from '@/constants/questions';
import { useTheme } from '@/contexts/ThemeContext';

interface QuestionCardProps {
  question: Question;
  compact?: boolean;
}

export default function QuestionCard({ question, compact = false }: QuestionCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <View style={[styles.optionChip, { backgroundColor: `${colors.optionA}20`, borderColor: `${colors.optionA}40` }]}>
          <View style={[styles.optionBadge, { backgroundColor: colors.optionA }]}>
            <Text style={styles.optionBadgeText}>A</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {question.optionA}
          </Text>
        </View>

        <Text style={styles.or}>OR</Text>

        <View style={[styles.optionChip, { backgroundColor: `${colors.optionB}20`, borderColor: `${colors.optionB}40` }]}>
          <View style={[styles.optionBadge, { backgroundColor: colors.optionB }]}>
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textSecondary,
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
      color: colors.textOnColor,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
    },
    optionText: {
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      flex: 1,
      lineHeight: 18,
    },
    or: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      textAlign: 'center',
      letterSpacing: 2,
    },
  });
}
