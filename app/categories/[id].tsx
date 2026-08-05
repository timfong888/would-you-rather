import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { CATEGORIES, getCategoryQuestions, FREE_TRIAL_COUNT, TOTAL_QUESTIONS_PER_CATEGORY } from '@/constants/questions';
import { COPY } from '@/constants/copy';
import type { CategoryId } from '@/constants/questions';
import { SITE_URL } from '@/constants/config';
import PageHead from '@/components/PageHead';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { answered, refresh } = useAnsweredQuestions();
  const { isUnlocked } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

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
  const categoryUnlocked = isUnlocked(category.id);
  const freeCount = isPremium && !categoryUnlocked ? FREE_TRIAL_COUNT : questions.length;

  const answeredCount = questions.filter((q) => answered[q.id] !== undefined).length;
  const unanswered = TOTAL_QUESTIONS_PER_CATEGORY - answeredCount;

  const handlePlay = (startIdx = 0) => {
    if (questions.length === 0) return;
    const q = questions[startIdx];
    router.push(`/game/${q.id}?cat=${category.id}&idx=${startIdx}`);
  };

  const pageTitle = `${category.label} — Would You Rather? ${category.emoji}`;
  const pageDescription = `${questions.length} Would You Rather dilemmas in the ${category.label} category. ${isPremium ? 'First 3 questions free.' : 'Free to play.'} See how your answers compare.`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={`${SITE_URL}/categories/${category.id}`}
      />
      {/* Category Hero */}
      <View style={[styles.hero, { borderColor: `${category.color}30`, backgroundColor: `${category.color}10` }]}>
        <Text style={styles.heroEmoji}>{category.emoji}</Text>
        <Text style={[styles.heroName, { color: category.color }]}>
          {category.label.toUpperCase()}
        </Text>
        <Text style={styles.heroCount}>{unanswered} of {TOTAL_QUESTIONS_PER_CATEGORY} unanswered</Text>

        {answeredCount > 0 && (
          <>
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>
                ✓ {answeredCount} OF {questions.length} ANSWERED
              </Text>
            </View>
            <View style={styles.heroProgressTrack}>
              <View
                style={[
                  styles.heroProgressFill,
                  {
                    backgroundColor: category.color,
                    width: `${(answeredCount / questions.length) * 100}%` as any,
                  },
                ]}
              />
            </View>
          </>
        )}

        {isPremium && !categoryUnlocked && (
          <View style={styles.trialBanner}>
            <Text style={styles.trialBannerText}>
              👑 Premium — first {FREE_TRIAL_COUNT} questions are free
            </Text>
          </View>
        )}
        {isPremium && categoryUnlocked && (
          <View style={[styles.trialBanner, styles.unlockedBanner]}>
            <Text style={[styles.trialBannerText, styles.unlockedBannerText]}>
              🔓 Unlocked — all {questions.length} questions available
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
          const isLocked = isPremium && !categoryUnlocked && idx >= FREE_TRIAL_COUNT;
          const answeredChoice = answered[q.id];
          const isAnswered = answeredChoice !== undefined;

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
                isAnswered && styles.questionRowAnswered,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.questionRowLeft}>
                {isLocked ? (
                  <Text style={[styles.questionNum, { color: colors.textMuted }]}>🔒</Text>
                ) : isAnswered ? (
                  <View style={[styles.answeredBadge, { backgroundColor: category.color }]}>
                    <Text style={styles.answeredBadgeText}>✓</Text>
                  </View>
                ) : (
                  <Text style={[styles.questionNum, { color: category.color }]}>{idx + 1}</Text>
                )}
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
              {!isLocked && !isAnswered && (
                <Text style={styles.questionChevron}>›</Text>
              )}
              {isLocked && (
                <View style={styles.unlockHint}>
                  <Text style={styles.unlockHintText}>Unlock</Text>
                </View>
              )}
              {isAnswered && (
                <View style={[styles.answeredTag, { borderColor: category.color }]}>
                  <Text style={[styles.answeredTagText, { color: category.color }]}>
                    {answeredChoice}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {isPremium && !categoryUnlocked && (
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.lg,
    },
    backButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    backButtonText: {
      color: colors.textOnColor,
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
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      letterSpacing: 1.5,
    },
    progressPill: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressPillText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 1.5,
    },
    heroProgressTrack: {
      width: '100%',
      height: 4,
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    heroProgressFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    trialBanner: {
      backgroundColor: colors.premiumBg,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.premium,
      marginTop: SPACING.xs,
    },
    trialBannerText: {
      color: colors.premium,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      textAlign: 'center',
    },
    unlockedBanner: {
      backgroundColor: colors.freeBg,
      borderColor: colors.free,
    },
    unlockedBannerText: {
      color: colors.free,
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
      color: colors.textOnColor,
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
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
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
    questionRowAnswered: {
      opacity: 0.75,
    },
    answeredBadge: {
      width: 22,
      height: 22,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    answeredBadgeText: {
      color: colors.textOnColor,
      fontSize: 11,
      fontWeight: FONTS.weights.extrabold,
    },
    answeredTag: {
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      flexShrink: 0,
    },
    answeredTagText: {
      fontSize: 10,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 0.5,
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
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      lineHeight: 18,
    },
    questionOr: {
      color: colors.textMuted,
      fontSize: 10,
      fontStyle: 'italic',
    },
    questionOptionB: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      lineHeight: 18,
    },
    textLockedBlur: {
      color: colors.textMuted,
      letterSpacing: 2,
    },
    questionChevron: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xl,
      flexShrink: 0,
    },
    unlockHint: {
      backgroundColor: colors.premiumBg,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.premium,
      flexShrink: 0,
    },
    unlockHintText: {
      color: colors.premium,
      fontSize: 10,
      fontWeight: FONTS.weights.bold,
    },
    unlockCta: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.premiumBg,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.premium,
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
      color: colors.premium,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    unlockCtaSub: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
    },
    unlockCtaArrow: {
      color: colors.premium,
      fontSize: FONTS.sizes.xl,
    },
  });
}
