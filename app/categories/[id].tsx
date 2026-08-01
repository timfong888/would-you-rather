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
import { CATEGORIES, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import { COPY } from '@/constants/copy';
import type { CategoryId } from '@/constants/questions';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const category = CATEGORIES.find((c) => c.id === id);

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

  const questions = getCategoryQuestions(category.id);

  const isPremium = category.tier === 'premium';
  const freeCount = isPremium ? FREE_TRIAL_COUNT : questions.length;

  const handlePlay = (startIdx = 0) => {
    if (questions.length === 0) return;
    const q = questions[startIdx];
    router.push(`/game/${q.id}?cat=${category.id}&idx=${startIdx}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Category Hero */}
      <View style={[styles.hero, { borderColor: `${category.color}30`, backgroundColor: `${category.color}10` }]}>
        <Text style={styles.heroEmoji}>{category.emoji}</Text>
        <Text style={[styles.heroName, { color: category.color }]}>
          {category.label.toUpperCase()}
        </Text>
        <Text style={styles.heroCount}>{COPY.dilemmaCount(questions.length)}</Text>

        {isPremium && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerText}>
              👑 Premium — first {FREE_TRIAL_COUNT} questions are free
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => handlePlay(0)}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: category.color },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.playButtonText}>PLAY ALL →</Text>
        </Pressable>
      </View>

      {/* Questions List */}
      <View style={styles.list}>
        {questions.map((q, idx) => {
          const isLocked = isPremium && idx >= FREE_TRIAL_COUNT;

          return (
            <Pressable
              key={q.id}
              onPress={() => {
                if (isLocked) {
                  router.push(`/unlock/${category.id}`);
                } else {
                  handlePlay(idx);
                }
              }}
              style={({ pressed }) => [
                styles.questionRow,
                isLocked && styles.questionRowLocked,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.questionRowLeft}>
                <Text style={[styles.questionNum, { color: isLocked ? COLORS.textMuted : category.color }]}>
                  {isLocked ? '🔒' : `${idx + 1}`}
                </Text>
              </View>
              <View style={styles.questionRowContent}>
                <Text style={[styles.questionOptionA, isLocked && styles.textLockedBlur]} numberOfLines={1}>
                  {isLocked ? '••••••••••••••••' : q.optionA}
                </Text>
                <Text style={styles.questionOr}>or</Text>
                <Text style={[styles.questionOptionB, isLocked && styles.textLockedBlur]} numberOfLines={1}>
                  {isLocked ? '••••••••••••••••' : q.optionB}
                </Text>

              </View>
              {!isLocked && (
                <Text style={styles.questionChevron}>›</Text>
              )}
              {isLocked && (
                <View style={styles.unlockHint}>
                  <Text style={styles.unlockHintText}>Unlock</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {isPremium && (
        <Pressable
          onPress={() => router.push(`/unlock/${category.id}`)}
          style={({ pressed }) => [
            styles.unlockCta,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.unlockCtaEmoji}>👑</Text>
          <View style={styles.unlockCtaText}>
            <Text style={styles.unlockCtaTitle}>Unlock All {questions.length} Dilemmas</Text>
            <Text style={styles.unlockCtaSub}>One-time category unlock · $2.99</Text>
          </View>
          <Text style={styles.unlockCtaArrow}>→</Text>
        </Pressable>
      )}

      <View style={{ height: SPACING.xxl }} />
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
  hero: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroEmoji: {
    fontSize: 48,
  },
  heroName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 3,
    textAlign: 'center',
  },
  heroCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 1.5,
  },
  trialBanner: {
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.premium,
    marginTop: SPACING.xs,
  },
  trialBannerText: {
    color: COLORS.premium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    textAlign: 'center',
  },
  playButton: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xxl,
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
    color: COLORS.textOnColor,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  list: {
    gap: SPACING.sm,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
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
  questionRowLocked: {
    opacity: 0.6,
  },
  questionRowLeft: {
    width: 28,
    alignItems: 'center',
    flexShrink: 0,
  },
  questionNum: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 0.5,
  },
  questionRowContent: {
    flex: 1,
    gap: 2,
  },
  questionOptionA: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    lineHeight: 18,
  },
  questionOr: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
  questionOptionB: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    lineHeight: 18,
  },
  textLockedBlur: {
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  questionChevron: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xl,
    flexShrink: 0,
  },
  unlockHint: {
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.premium,
    flexShrink: 0,
  },
  unlockHintText: {
    color: COLORS.premium,
    fontSize: 10,
    fontWeight: FONTS.weights.bold,
  },
  unlockCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.premium,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  unlockCtaEmoji: {
    fontSize: 24,
  },
  unlockCtaText: {
    flex: 1,
    gap: 2,
  },
  unlockCtaTitle: {
    color: COLORS.premium,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  unlockCtaSub: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
  unlockCtaArrow: {
    color: COLORS.premium,
    fontSize: FONTS.sizes.xl,
  },
});
