import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { browseHrefFor } from '@/lib/browse';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import {
  CATEGORIES,
  getCategoryById,
  getCategoryQuestions,
  getQuestionById,
  getAccessibleQuestions,
  getNextTranche,
  isKidsCategoryId,
  SELLABLE_TRANCHE_MAX,
  trancheSize,
} from '@/constants/questions';
import { COPY } from '@/constants/copy';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked, WEB_FREE_UNLOCK } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import VoteBar from '@/components/VoteBar';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { track, buildShareUrl } from '@/lib/analytics';
import { nativeShareOptions } from '@/lib/shareQuestion';
import { SHARE_PROMPT } from '@/lib/shareInvite';
import { useTally } from '@/lib/useTally';
import { INVITE_TITLE, INVITE_TEXT } from '@/lib/results';
import { pickNextCategory } from '@/lib/nextCategory';
import SafeScrollView from '@/components/SafeScrollView';

export default function CompleteScreen() {
  const { id, voted, q } = useLocalSearchParams<{ id: string; voted: 'A' | 'B'; q: string }>();
  const router = useRouter();
  const { openTranches, priceForCategory } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);
  const anim = useRef(new Animated.Value(0)).current;
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const { incomingLinkId, incomingGeneration, visitorId } = useAnalytics();

  const category = getCategoryById((id ?? '') as CategoryId);
  const questions = getCategoryQuestions((id ?? '') as CategoryId);
  const safeVoted = voted === 'A' || voted === 'B' ? voted : null;
  const lastQuestion = q ? getQuestionById(q) : questions[questions.length - 1];
  const result = useTally(lastQuestion?.id);

  useEffect(() => {
    if (category) track('category_completed', { category: category.id, visitor_id: visitorId });
  }, [category?.id]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleShareChallenge = useCallback(async () => {
    if (!lastQuestion) return;
    const title = 'Would You Rather?';
    const text = SHARE_PROMPT;
    const { url: shareUrl, linkId } = buildShareUrl(lastQuestion.id, incomingGeneration, isKidsCategoryId(id ?? ''));

    track('share_clicked', {
      question_id: lastQuestion.id,
      surface: 'complete_challenge',
      link_id: linkId,
      visitor_id: visitorId,
    });
    if (incomingLinkId) {
      track('visitor_shared_after_link', {
        link_id: incomingLinkId,
        generation: incomingGeneration,
        new_link_id: linkId,
        visitor_id: visitorId,
      });
    }

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
      Share.share(nativeShareOptions({ title, text, url: shareUrl, os: Platform.OS }));
    }
  }, [lastQuestion, id, incomingGeneration, incomingLinkId, visitorId]);

  const handleShareMyTake = useCallback(async () => {
    if (!lastQuestion || !safeVoted) return;
    const title = 'My Would You Rather Take';
    const text = SHARE_PROMPT;
    // The pick travels as the `f` code and is shown only inside the app after the recipient answers (#188).
    const { url: shareUrl, linkId } = buildShareUrl(lastQuestion.id, incomingGeneration, isKidsCategoryId(id ?? ''), safeVoted);

    track('share_clicked', {
      question_id: lastQuestion.id,
      surface: 'complete_my_take',
      link_id: linkId,
      visitor_id: visitorId,
    });
    if (incomingLinkId) {
      track('visitor_shared_after_link', {
        link_id: incomingLinkId,
        generation: incomingGeneration,
        new_link_id: linkId,
        visitor_id: visitorId,
      });
    }

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
      Share.share(nativeShareOptions({ title, text, url: shareUrl, os: Platform.OS }));
    }
  }, [lastQuestion, safeVoted, id, incomingGeneration, incomingLinkId, visitorId]);

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
  const access = openTranches(category);
  // Everything the user could play without paying counts as "completed" here;
  // what's left is the upsell: the next tranche to open.
  const completedCount = getAccessibleQuestions(category, access).length;
  const remaining = questions.length - completedCount;
  const nextTranche = getNextTranche(category, access);
  const nextSize = nextTranche ? trancheSize(nextTranche) : 0;
  const sellable = nextTranche !== undefined && (nextTranche.k <= SELLABLE_TRANCHE_MAX || WEB_FREE_UNLOCK);

  const nextCategory = pickNextCategory(CATEGORIES, id ?? '');

  const myChoice = safeVoted;
  const myPct = result.kind === 'percent' ? (myChoice === 'A' ? result.a : result.b) : null;
  const withMajority = myPct !== null && myPct >= 50;

  return (
    <SafeScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>

        {/* Completion Header */}
        <View style={[styles.completionHeader, { borderColor: `${catColor}30`, backgroundColor: `${catColor}10` }]}>
          <Text style={styles.completionEmoji}>🏁</Text>
          <Text style={[styles.completionTitle, { color: catColor }]} accessibilityRole="header">
            {remaining > 0 ? `You've finished the free part of ${category.label}` : `You've finished ${category.label}`}
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
              percent={result.kind === 'percent' ? result.a : undefined}
              total={result.kind === 'percent' ? result.total : undefined}
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
              percent={result.kind === 'percent' ? result.b : undefined}
              total={result.kind === 'percent' ? result.total : undefined}
              userVoted={myChoice === 'B'}
            />

            {result.kind === 'percent' ? (
              <Text style={styles.totalVotesText}>{result.total.toLocaleString()} total votes</Text>
            ) : (
              <Text style={styles.totalVotesText}>{INVITE_TITLE}. {INVITE_TEXT}</Text>
            )}

            {/* Majority verdict (only from real percentages) */}
            {result.kind === 'percent' && (
            <View style={[styles.verdictRow, { borderColor: withMajority ? colors.success : colors.secondary }]}>
              <Text style={styles.verdictEmoji}>{withMajority ? '🎯' : '🔥'}</Text>
              <Text style={[styles.verdictText, { color: withMajority ? colors.success : colors.secondary }]}>
                {withMajority
                  ? `You're with the majority! (${myPct}% agreed)`
                  : `You're in the minority — uniquely you!${myChoice ? ` (${myPct}% chose Option ${myChoice})` : ''}`}
              </Text>
            </View>
            )}
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

        {/* Upsell Card: the next tranche to open */}
        {remaining > 0 && (
          <Pressable
            disabled={!sellable}
            onPress={() => router.push(`/unlock/${id}`)}
            style={({ pressed }) => [
              styles.upsellCard,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.upsellTop}>
              <Text style={styles.upsellIcon}>🔓</Text>
              <View style={styles.upsellTextBlock}>
                <Text style={styles.upsellTitle}>
                  KEEP THE CONVERSATION GOING
                </Text>
                <Text style={styles.upsellHook}>
                  {`You've played all ${completedCount} free ${category.label} dilemmas. ${nextSize} more are waiting.`}
                </Text>
              </View>
            </View>
            <Text style={styles.upsellDesc}>
              Your favorite topic doesn't have to end here. Fresh dilemmas, same category, brand-new debates.
            </Text>
            <View style={styles.upsellCta}>
              <Text style={styles.upsellCtaText}>
                {sellable ? `${COPY.openNextShort(nextSize)} · ${priceForCategory(id as string)}${WEB_FREE_UNLOCK ? ' · FREE FOR NOW' : ''}` : 'MORE AVAILABLE SOON'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Navigation Actions */}
        <View style={styles.actions}>
          {nextCategory && (
            <Pressable
              onPress={() => {
                track('next_category_clicked', { from: id, to: nextCategory.id, visitor_id: visitorId });
                const first = getCategoryQuestions(nextCategory.id as CategoryId)[0];
                router.push(`/game/${first.id}?cat=${nextCategory.id}&idx=0`);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.nextCta, { backgroundColor: nextCategory.color }, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.nextCtaText}>{`NEXT: ${nextCategory.emoji} ${nextCategory.label.toUpperCase()} →`}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push(browseHrefFor(category.id))}
            style={({ pressed }) => [
              styles.exploreCta,
              { borderColor: catColor },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.exploreCtaText, { color: catColor }]}>ALL CATEGORIES →</Text>
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
    </SafeScrollView>
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
      fontSize: FONTS.sizes.xl,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 0.5,
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
    nextCta: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    nextCtaText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1.5,
      textAlign: 'center',
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
