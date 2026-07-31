import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import type { Category } from '@/constants/questions';

interface CategoryCardProps {
  id: Category;
  label: string;
  emoji: string;
  color: string;
  questionCount: number;
  onPress: () => void;
}

export default function CategoryCard({
  label,
  emoji,
  color,
  questionCount,
  onPress,
}: CategoryCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderColor: `${color}40`, backgroundColor: `${color}10` },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Text style={styles.count}>{questionCount} questions</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    textAlign: 'center',
  },
  count: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
});
