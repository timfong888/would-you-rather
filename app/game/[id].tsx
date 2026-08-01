import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getQuestionById, getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { SEO, SITE_URL } from '@/constants/config';
import OptionButton from '@/components/OptionButton';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';

export default function GameScreen() {
  const { id, cat, idx } = useLocalSearchParams<{ id: string; cat: string; idx: string }>();
  const router = useRouter();
  const { isUnlocked } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { markAnswered } = useAnsweredQuestions();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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

  const catColor = category?.color ?? colors.magenta;
  const isLastInCategory = cat ? currentIdx >= totalInCategory - 1 : false;
  const nextIdx = currentIdx + 1;
  const nextQuestion = cat && nextIdx < categoryQuestions.length ? categoryQuestions[nextIdx] : null;

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
    markAnswered(question!.id, selected);
  };

  const handleNext = () => {
    if (!selected) return;

    if (isLastInCategory && cat) {
      router.push(`/complete/${cat}?voted=${selected}&q=${id}`);
      return;
    }

    if (nextQuestion && cat) {
      const catDef = getCategoryById(cat as CategoryId);
      if (catDef?.tier === 'premium' && nextIdx >= FREE_TRIAL_COUNT && !isUnlocked(cat as CategoryId)) {
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
      if (catDef?.tier === 'premium' && nextIdx >= FREE_TRIAL_COUNT && !isUnlocked(cat as CategoryId)) {
        router.push(`/unlock/${cat}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${cat}&idx=${nextIdx}`);
    } else {
      router.push('/categories');
    }
  };

  const handleLeaveCategory = () => {
    router.push('/categories');
  };

  const shareUrl = Platform.select({
    web: typeof window !== 'undefined'
      ? `${window.location.origin}/p/${id}`
      : `/p/${id}`,
    default: `/p/${id}`,
  }) as string;

  // Voluntary pre-answer challenge: share the question before confirming
  const handleChallengeShare = useCallback(async () => {
    const title = 'Would You Rather?';
    const text = `${question?.optionA} — OR — ${question?.optionB}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try { await navigator.share({ title, text, url: shareUrl }); return; } catch {}
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopyFeedback('Link copied!');
          setTimeout(() => setCopyFeedback(null), 2000);
        } catch {}
      }
    } else {
      Share.share({ title, message: `${text}\n\n${shareUrl}`, url: shareUrl });
    }
  }, [question, shareUrl, setCopyFeedback]);

  const votesA = confirmed && selected === 'A' ? question.votesA + 1 : question.votesA;
  const votesB = confirmed && selected === 'B' ? question.votesB + 1 : question.votesB;

  const pageTitle = `Would You Rather: ${question.optionA} — or — ${question.optionB}?`;
  const truncatedTitle = pageTitle.length > 100
    ? `Would You Rather? ${category ? `[${category.label}]` : ''} — Play Now`
    : pageTitle;
  const pageDescription = `Would you rather ${question.optionA.toLowerCase()} — or — ${question.optionB.toLowerCase()}? Cast your vote and see how others answered.`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Head>
        <title>{truncatedTitle}</title>
        <meta name="description" content={pageDescription.slice(0, 160)} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${SITE_URL}/game/${question.id}`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE_URL}/game/${question.id}`} />
        <meta property="og:title" content={truncatedTitle} />
        <meta property="og:description" content={pageDescription.slice(0, 200)} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content={SEO.twitterHandle} />
        <meta name="twitter:title" content={truncatedTitle} />
        <meta name="twitter:description" content={pageDescription.slice(0, 200)} />
      </Head>
      {/* Leave Category Link */}
      {category && (
        <Pressable
          onPress={handleLeaveCategory}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          style={({ pressed }) => [
            styles.leaveTopButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.leaveActionText}>← All Categories</Text>
        </Pressable>
      )}

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
          <View style={[styles.heartBadge, { borderColor: `${catColor}60`, backgroundColor: `${catColor}15` }]}>
            <Text style={[styles.heartText, { color: catColor }]}>♥</Text>
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
                { backgroundColor: selected ? catColor : colors.surfaceLight },
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

            {/* Contextual challenge invite — shown when user picked but hasn't confirmed */}
            {selected && (
              <Pressable
                onPress={handleChallengeShare}
                style={({ pressed }) => [
                  styles.challengeButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.challengeText}>{copyFeedback ?? '💬  Challenge a friend to this question first'}</Text>
              </Pressable>
            )}

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

            {category && (
              <Pressable
                onPress={handleLeaveCategory}
                hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                style={({ pressed }) => [
                  styles.leaveBottomButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.leaveActionText}>✕ Leave Category</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={[styles.resultBanner, { borderColor: `${catColor}40` }]}>
              <Text style={styles.resultBannerEmoji}>
                {selected === 'A'
                  ? (votesA > votesB ? '🎯' : '🔥')
                  : (votesB > votesA ? '🎯' : '🔥')}
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 1.5,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    wyrLabel: {
      color: colors.textSecondary,
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
      backgroundColor: colors.border,
    },
    heartBadge: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heartText: {
      fontSize: 18,
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
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    confirmButtonTextDisabled: {
      color: colors.textMuted,
    },
    challengeButton: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    challengeText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
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
      color: colors.textMuted,
      fontSize: FONTS.sizes.md,
    },
    resultBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
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
      color: colors.text,
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.extrabold,
    },
    resultBannerSub: {
      color: colors.textSecondary,
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
      color: colors.textOnColor,
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
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    hint: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    leaveActionText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      letterSpacing: 0.3,
    },
    leaveTopButton: {
      alignSelf: 'flex-start',
      paddingVertical: SPACING.xs,
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
    leaveBottomButton: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
  });
}
