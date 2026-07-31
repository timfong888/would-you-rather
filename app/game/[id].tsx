import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import { getQuestionById, CATEGORIES, QUESTIONS } from '@/constants/questions';
import OptionButton from '@/components/OptionButton';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const question = getQuestionById(id);

  if (!question) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Question not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const category = CATEGORIES.find((c) => c.id === question.category);
  const currentIndex = QUESTIONS.findIndex((q) => q.id === id);
  const nextQuestion = QUESTIONS[currentIndex + 1] || QUESTIONS[0];

  const handleSelect = (option: 'A' | 'B') => {
    if (!hasVoted) setSelected(option);
  };

  const handleVote = () => {
    if (!selected) return;
    setHasVoted(true);
    router.push(`/results/${id}?voted=${selected}`);
  };

  const handleSkip = () => {
    router.push(`/game/${nextQuestion.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Category badge */}
      {category && (
        <View style={[styles.categoryBadge, { backgroundColor: `${category.color}20` }]}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: category.color }]}>
            {category.label}
          </Text>
        </View>
      )}

      {/* Question header */}
      <View style={styles.questionHeader}>
        <Text style={styles.questionLabel}>Would you rather...</Text>
        <Text style={styles.questionProgress}>
          {currentIndex + 1} / {QUESTIONS.length}
        </Text>
      </View>

      {/* Options */}
      <View style={styles.options}>
        <OptionButton
          label="A"
          text={question.optionA}
          selected={selected === 'A'}
          onPress={() => handleSelect('A')}
          disabled={hasVoted}
        />

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <View style={styles.orBadge}>
            <Text style={styles.orText}>OR</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        <OptionButton
          label="B"
          text={question.optionB}
          selected={selected === 'B'}
          onPress={() => handleSelect('B')}
          disabled={hasVoted}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleVote}
          disabled={!selected}
          style={({ pressed }) => [
            styles.voteButton,
            !selected && styles.voteButtonDisabled,
            pressed && selected && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.voteButtonText, !selected && styles.voteButtonTextDisabled]}>
            {selected ? `Lock in Option ${selected}` : 'Pick an option first'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.skipButtonText}>Skip →</Text>
        </Pressable>
      </View>

      {/* Hint */}
      {!selected && (
        <Text style={styles.hint}>
          Tap an option to make your choice
        </Text>
      )}

      {selected && (
        <Text style={styles.hint}>
          You chose Option {selected} — tap "Lock in" to see results!
        </Text>
      )}
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
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
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
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.lg,
    fontStyle: 'italic',
    fontWeight: FONTS.weights.medium,
  },
  questionProgress: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
  options: {
    gap: SPACING.md,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  orBadge: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  orText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 2,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  voteButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
      },
    }),
  },
  voteButtonDisabled: {
    backgroundColor: COLORS.surfaceLight,
  },
  voteButtonText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  voteButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  skipButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
