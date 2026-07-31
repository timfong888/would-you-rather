import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import { CATEGORIES, getQuestionsByCategory } from '@/constants/questions';
import type { Category } from '@/constants/questions';
import QuestionCard from '@/components/QuestionCard';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const category = CATEGORIES.find((c) => c.id === id);
  const questions = getQuestionsByCategory(id as Category);

  if (!category) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Category not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handlePlayAll = () => {
    if (questions.length > 0) {
      router.push(`/game/${questions[0].id}`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Category Hero */}
      <View style={[styles.categoryHero, { backgroundColor: `${category.color}15`, borderColor: `${category.color}30` }]}>
        <Text style={styles.categoryEmoji}>{category.emoji}</Text>
        <Text style={[styles.categoryName, { color: category.color }]}>{category.label}</Text>
        <Text style={styles.questionCount}>{questions.length} questions</Text>

        <Pressable
          onPress={handlePlayAll}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: category.color },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.playButtonText}>Play All →</Text>
        </Pressable>
      </View>

      {/* Questions List */}
      <View style={styles.questionList}>
        {questions.map((q, idx) => (
          <View key={q.id} style={styles.questionWrapper}>
            <Text style={styles.questionIndex}>#{idx + 1}</Text>
            <View style={styles.questionCardWrapper}>
              <QuestionCard question={q} compact />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.lg,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: FONTS.weights.bold,
  },
  categoryHero: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryEmoji: {
    fontSize: 48,
  },
  categoryName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
  },
  questionCount: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  playButton: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
      },
    }),
  },
  playButtonText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  questionList: {
    gap: SPACING.md,
  },
  questionWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  questionIndex: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    paddingTop: SPACING.md,
    minWidth: 28,
    textAlign: 'right',
  },
  questionCardWrapper: {
    flex: 1,
  },
});
