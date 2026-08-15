import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import {
  getCategoryById,
  getCategoryQuestions,
  getQuestionById,
  FREE_TRIAL_COUNT,
} from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import VoteBar from '@/components/VoteBar';

export default function CompleteScreen() {
  const { id, voted, q } = useLocalSearchParams<{ id: string; voted: 'A' | 'B'; q: string }>();
  const router = useRouter();
  const { isUnlocked } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);
  const anim = useRef(new Animated.Value(0)).current;
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const category = getCategoryById((id ?? '') as CategoryId);
  const questions = getCategoryQuestions((id ?? '') as CategoryId);
  const safeVoted = voted === 'A' || voted === 'B' ? voted : null;
  const lastQuestion = q ? getQuestionById(q) : questions[questions.length - 1];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const shareUrl = Platform.select({
    web: typeof window !== 'undefined'
      ? `${window.location.origin}/p/${lastQuestion?.id ?? ''}`
      : `/p/${lastQuestion?.id ?? ''}`,
    default: `/p/${lastQuestion?.id ?? ''}`,
  }) as string;

  const handleShareChallenge = useCallback(async () => {
    if (!lastQuestion) return;
    const title = 'Would You Rather?';
    const text = `${lastQuestion.optionA} — OR — ${lastQuestion.optionB}`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try { await navigator.share({ title, text, url: shareUrl }); return; } catch {}
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopyFeedback('Copied!');
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    } else {
      Share.share({ title, message: `${text}\n\n${shareUrl}`, url: shareUrl });
    }
  }, [lastQuestion, shareUrl]);

  const handleShareMyTake = useCallback(async () => {
    if (!lastQuestion || !voted) return;
    const myOption = voted === 'A' ? lastQuestion.optionA : lastQuestion.optionB;
    const title = 'My Would You Rather Take';
    const text = `I chose: "${myOption}" — do you agree?`;
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try { await navigator.share({ title, text, url: shareUrl }); return; } catch {}
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
        setCopyFeedback('Copied!');
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    } else {
      Share.share({ title, message: `${text}\n\n${shareUrl}`, url: shareUrl });
    }
  }, [lastQuestion, voted, shareUrl]);

  if (!category) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Category not found</Text>
        <Pressable onPress={() => router.push('/')} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const catColor = category.color;
  const categoryUnlocked = isUnlocked(id as CategoryId);
  const isPremium = category.tier === 'premium';
  const completedCount = isPremium && !categoryUnlocked ? FREE_TRIAL_COUNT : questions.length;
  const remaining = questions.length - completedCount;

  const votesA = lastQuestion ? (safeVoted === 'A' ? lastQuestion.votesA + 1 : lastQuestion.votesA) : 0;
  const votesB = lastQuestion ? (safeVoted === 'B' ? lastQuestion.votesB + 1 : lastQuestion.votesB) : 0;
  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;
  const myChoice = safeVoted;
  const myVotes = myChoice === 'A' ? votesA : votesB;
  const myPct = myChoice === 'A' ? pctA : pctB;
  const withMajority = myVotes >= (totalVotes / 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>

        {/* Completion Header */}
        <View style={[styles.completionHeader, { borderColor: `${catColor}30`, backgroundColor: `${catColor}10` }]}>
          <Text style={styles.completionEmoji}>🏁</Text>
          <Text style={[styles.completionTitle, { color: catColor }]}>
            {category.label.toUpperCase()}
          </Text>
          <Text style={styles.completionSubtitle}>
            {completedCount} OF {questions.length} COMPLETED
          </Text>
        </View>

        {/* YOUR CHOICE vs GLOBAL VOTE */}
        {lastQuestion && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsCardLabel}>WOULD YOU RATHER...</Text>

            <VoteBar
              label="A"
              text={lastQuestion.optionA}
              votes={votesA}
              totalVotes={totalVotes}
              userVoted={myChoice === 'A'}
            />

            <View style={styles.orRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <VoteBar
              label="B"
              text={lastQuestion.optionB}
              votes={votesB}
              totalVotes={totalVotes}
              userVoted={myChoice === 'B'}
            />

            <Text style={styles.totalVotesText}>{totalVotes.toLocaleString()} total votes</Text>

            {/* Majority verdict */}
            <View style={[styles.verdictRow, { borderColor: withMajority ? colors.success : colors.secondary }]}>
              <Text style={styles.verdictEmoji}>{withMajority ? '🎯' : '🔥'}</Text>
              <Text style={[styles.verdictText, { color: withMajority ? colors.success : colors.secondary }]}>
                {withMajority
                  ? `You're with the majority! (${myPct}% agreed)`
                  : `You're in the minority — uniquely you!${myChoice ? ` (${myPct}% chose Option ${myChoice})` : ''}`}
              </Text>
            </View>
          </View>
        )}

        {/* Share Row */}
        <View style={styles.shareCard}>
          <Pressable
            onPress={handleShareChallenge}
            style={({ pressed }) => [styles.sharePrimaryBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.sharePrimaryBtnText}>
              {copyFeedback ?? '🔗  Challenge friends'}
            </Text>
          </Pressable>
          {voted && (
            <Pressable
              onPress={handleShareMyTake}
              style={({ pressed }) => [styles.shareSecondaryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.shareSecondaryBtnText}>
                {`${withMajority ? '🎯' : '🔥'}  Share my take`}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Premium Upsell Card */}
        {isPremium && remaining > 0 && (
          <Pressable
            onPress={() => router.push(`/unlock/${id}`)}
            style={({ pressed }) => [
              styles.upsellCard,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.upsellTop}>
              <Text style={styles.upsellIcon}>🔓</Text>
              <View style={styles.upsellTextBlock}>
                <Text style={styles.upsellTitle}>THE DEPTHS AWAIT</Text>
                <Text style={styles.upsellHook}>
                  Unlock {remaining} more {category.label} dilemmas — the ones that spark real debate
                </Text>
              </View>
            </View>
            <Text style={styles.upsellDesc}>
              You've only scratched the surface. The questions that reveal who people really are are waiting.
            </Text>
            <View style={styles.upsellCta}>
              <Text style={styles.upsellCtaText}>EXTEND COLLECTION · $2.99</Text>
            </View>
          </Pressable>
        )}

        {/* Navigation Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/categories')}
            style={({ pressed }) => [
              styles.exploreCta,
              { borderColor: catColor },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.exploreCtaText, { color: catColor }]}>EXPLORE NEW CATEGORIES →</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const firstQ = questions[0];
              router.push(`/game/${firstQ.id}?cat=${id}&idx=0`);
            }}
            style={({ pressed }) => [
              styles.replayLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.replayLinkText}>Replay this category</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/')}
            style={({ pressed }) => [
              styles.homeLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.homeLinkText}>Back to Home</Text>
          </Pressable>
        </View>

      </Animated.View>
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
    homeButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    homeButtonText: {
      color: colors.textOnColor,
      fontWeight: FONTS.weights.bold,
    },
    completionHeader: {
      borderWidth: 1,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    completionEmoji: {
      fontSize: 48,
    },
    completionTitle: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 3,
      textAlign: 'center',
    },
    completionSubtitle: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      letterSpacing: 2,
      fontWeight: FONTS.weights.bold,
    },
    resultsCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultsCardLabel: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontStyle: 'italic',
      letterSpacing: 0.5,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    orText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 2,
    },
    totalVotesText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
    },
    verdictRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
    },
    verdictEmoji: {
      fontSize: 24,
    },
    verdictText: {
      flex: 1,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      lineHeight: 20,
    },
    shareCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
    sharePrimaryBtn: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    sharePrimaryBtnText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    shareSecondaryBtn: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    shareSecondaryBtnText: {
      color: colors.primary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    upsellCard: {
      backgroundColor: colors.premiumBg,
      borderWidth: 1.5,
      borderColor: colors.premium,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
    upsellTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    upsellIcon: {
      fontSize: 32,
    },
    upsellTextBlock: {
      flex: 1,
      gap: SPACING.xs,
    },
    upsellTitle: {
      color: colors.premium,
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    upsellHook: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.semibold,
      lineHeight: 22,
    },
    upsellDesc: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      lineHeight: 20,
    },
    upsellCta: {
      backgroundColor: colors.premium,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    upsellCtaText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    actions: {
      gap: SPACING.sm,
    },
    exploreCta: {
      borderWidth: 1.5,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
      }),
    },
    exploreCtaText: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    replayLink: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    replayLinkText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
    },
    homeLink: {
      alignItems: 'center',
      paddingVertical: SPACING.xs,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    homeLinkText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
    },
  });
}
