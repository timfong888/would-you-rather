import React, { useState } from 'react';
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
import { getQuestionById, getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import OptionButton from '@/components/OptionButton';

export default function GameScreen() {
  const { id, cat, idx } = useLocalSearchParams<{ id: string; cat: string; idx: string }>();
  const router = useRouter();
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const question = getQuestionById(id);
  const category = cat ? getCategoryById(cat as CategoryId) : undefined;
  const categoryQuestions = cat ? getCategoryQuestions(cat as CategoryId) : [];
  const currentIdx = idx !== undefined ? parseInt(idx, 10) : 0;
  const totalInCategory = categoryQuestions.length;

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

  const catColor = category?.color ?? COLORS.magenta;
  const isLastInCategory = cat ? currentIdx >= totalInCategory - 1 : false;
  const nextIdx = currentIdx + 1;
  const nextQuestion = cat && nextIdx < categoryQuestions.length ? categoryQuestions[nextIdx] : null;

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
  };

  const handleNext = () => {
    if (!selected) return;

    if (isLastInCategory && cat) {
      router.push(`/complete/${cat}?voted=${selected}&q=${id}`);
      return;
    }

    if (nextQuestion && cat) {
      // Check premium gate
      const catDef = getCategoryById(cat as CategoryId);
      if (catDef?.tier === 'premium' && nextIdx >= FREE_TRIAL_COUNT) {
        router.push(`/unlock/${cat}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${cat}&idx=${nextIdx}`);
    } else {
      router.push('/');
    }
  };

  const handleSkip = () => {
    if (nextQuestion && cat) {
      const catDef = getCategoryById(cat as CategoryId);
      if (catDef?.tier === 'premium' && nextIdx >= FREE_TRIAL_COUNT) {
        router.push(`/unlock/${cat}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${cat}&idx=${nextIdx}`);
    } else {
      router.push('/categories');
    }
  };

  const votesA = confirmed && selected === 'A' ? question.votesA + 1 : question.votesA;
  const votesB = confirmed && selected === 'B' ? question.votesB + 1 : question.votesB;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Category + Progress Header */}
      {category && (
        <View style={styles.progressHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${catColor}20` }]}>
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: catColor }]}>
              {category.label.toUpperCase()}
            </Text>
          </View>
          {totalInCategory > 0 && (
            <Text style={styles.progressText}>
              QUESTION {currentIdx + 1} OF {totalInCategory}
            </Text>
          )}
        </View>
      )}

      {/* Progress Bar */}
      {totalInCategory > 0 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: catColor,
                width: `${((currentIdx + (confirmed ? 1 : 0)) / totalInCategory) * 100}%` as any,
              },
            ]}
          />
        </View>
      )}

      {/* WYR Label */}
      <Text style={styles.wyrLabel}>WOULD YOU RATHER...</Text>

      {/* Options */}
      <View style={styles.options}>
        <OptionButton
          label="A"
          text={question.optionA}
          selected={selected === 'A'}
          onPress={() => { if (!confirmed) setSelected('A'); }}
          disabled={confirmed}
          votesA={votesA}
          votesB={votesB}
          showConsensus={confirmed}
        />

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <View style={[styles.diamondBadge, { borderColor: `${catColor}60` }]}>
            <Text style={[styles.diamondText, { color: catColor }]}>◆</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        <OptionButton
          label="B"
          text={question.optionB}
          selected={selected === 'B'}
          onPress={() => { if (!confirmed) setSelected('B'); }}
          disabled={confirmed}
          votesA={votesA}
          votesB={votesB}
          showConsensus={confirmed}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {!confirmed ? (
          <>
            <Pressable
              onPress={handleConfirm}
              disabled={!selected}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: selected ? catColor : COLORS.surfaceLight },
                pressed && selected && styles.buttonPressed,
              ]}
            >
              <Text style={[
                styles.confirmButtonText,
                !selected && styles.confirmButtonTextDisabled,
              ]}>
                {selected ? 'CONFIRM PREFERENCE' : 'PICK AN OPTION FIRST'}
              </Text>
            </Pressable>

            {nextQuestion && (
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.skipText}>Skip →</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            {/* Post-confirmation state */}
            <View style={[styles.resultBanner, { borderColor: `${catColor}40` }]}>
              <Text style={styles.resultBannerEmoji}>
                {selected === 'A'
                  ? (question.votesA > question.votesB ? '🎯' : '🔥')
                  : (question.votesB > question.votesA ? '🎯' : '🔥')}
              </Text>
              <View style={styles.resultBannerText}>
                <Text style={styles.resultBannerTitle}>
                  {(() => {
                    const myVotes = selected === 'A' ? votesA : votesB;
                    const otherVotes = selected === 'A' ? votesB : votesA;
                    return myVotes >= otherVotes ? 'With the majority!' : 'Uniquely yours!';
                  })()}
                </Text>
                <Text style={styles.resultBannerSub}>
                  You chose Option {selected}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.nextButton,
                { backgroundColor: catColor },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.nextButtonText}>
                {isLastInCategory ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSelected(null);
                setConfirmed(false);
              }}
              style={({ pressed }) => [
                styles.replayButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.replayText}>Change my answer</Text>
            </Pressable>
          </>
        )}
      </View>

      {!selected && !confirmed && (
        <Text style={styles.hint}>Tap an option to make your choice</Text>
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
    backgroundColor: COLORS.magenta,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: FONTS.weights.bold,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.5,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  wyrLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    fontStyle: 'italic',
    fontWeight: FONTS.weights.medium,
    textAlign: 'center',
    letterSpacing: 0.5,
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
  diamondBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  diamondText: {
    fontSize: 14,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  confirmButton: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  confirmButtonText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  confirmButtonTextDisabled: {
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
  skipText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.md,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
  },
  resultBannerEmoji: {
    fontSize: 32,
  },
  resultBannerText: {
    flex: 1,
    gap: 2,
  },
  resultBannerTitle: {
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.extrabold,
  },
  resultBannerSub: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  nextButton: {
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
  nextButtonText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  replayButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  replayText: {
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
