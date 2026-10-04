import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useRootNavigationState } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getQuestionById, getCategoryById, getCategoryQuestions, isQuestionLocked } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { SITE_URL } from '@/constants/config';
import PageHead from '@/components/PageHead';
import OptionButton from '@/components/OptionButton';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { track, buildShareUrl } from '@/lib/analytics';

// Shape of the link_id that buildShareUrl() emits (RFC 4122 v4 UUID).
const SHARE_LINK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function GameScreen() {
  const { id, cat, idx, link_id } = useLocalSearchParams<{ id: string; cat: string; idx: string; link_id: string }>();
  const router = useRouter();
  const { isUnlocked } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { markAnswered, refresh } = useAnsweredQuestions();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const { incomingLinkId, incomingGeneration, visitorId } = useAnalytics();

  const question = getQuestionById(id);
  // The category always comes from the question itself (the URL's `cat` is a
  // hint, never a source of truth), so a bare /game/:id link still gates.
  const catId = (question?.category ?? (cat as CategoryId | undefined)) as CategoryId | undefined;
  const category = catId ? getCategoryById(catId) : undefined;
  const categoryQuestions = catId ? getCategoryQuestions(catId) : [];
  // Likewise the index is the question's real position, not the URL's `idx`.
  const realIdx = question ? categoryQuestions.findIndex((q) => q.id === question.id) : -1;
  const currentIdx = realIdx >= 0 ? realIdx : (idx !== undefined ? parseInt(idx, 10) || 0 : 0);
  const totalInCategory = categoryQuestions.length;

  // Self-guard: a locked question reached by typing a URL is bounced to the
  // category page (which shows it locked with an Unlock affordance).
  // Exception: arriving via a share link (link_id) — the shared question is
  // intentionally playable as the hook of the share loop; the gate still
  // applies the moment they try to continue.
  //
  // Known client-side limitation: link_ids are generated client-side
  // (lib/analytics buildShareUrl) and there is no server to validate them
  // against, so a forged v4 UUID also passes. Requiring the exact shape the
  // share system produces removes the trivial "?link_id=x" route; real
  // enforcement needs server-side entitlements (see docs/owner-access.md).
  const arrivedViaShare = typeof link_id === 'string' && SHARE_LINK_ID_RE.test(link_id);
  const currentLocked = !!(category && question && isQuestionLocked(category, currentIdx, isUnlocked(category.id)));
  const mustRedirect = currentLocked && !arrivedViaShare;
  // On a cold deep link the root navigator may not be mounted on first render;
  // navigating before it is ready throws, so wait for the root state key.
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (mustRedirect && category && navReady) router.replace(`/categories/${category.id}`);
  }, [mustRedirect, category, navReady, router]);

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

  if (mustRedirect) return null;

  const catColor = category?.color ?? colors.magenta;
  const isLastInCategory = catId ? currentIdx >= totalInCategory - 1 : false;
  const nextIdx = currentIdx + 1;
  const nextQuestion = catId && nextIdx < categoryQuestions.length ? categoryQuestions[nextIdx] : null;
  // Is the next question behind the unlock? (premium trial ended, or the free
  // set of a free category is finished and the expansion pack starts.)
  const nextLocked = !!(category && nextQuestion && isQuestionLocked(category, nextIdx, isUnlocked(category.id)));
  // Finishing the free set of a free category is a real milestone: celebrate
  // it on the complete screen (which carries the expansion upsell) instead of
  // dropping straight onto the paywall. Premium trials keep the direct paywall.
  const endsFreeSet = nextLocked && category?.tier === 'free';

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
    markAnswered(question!.id, selected);
    track('question_answered', {
      question_id: question!.id,
      category: catId ?? undefined,
      choice: selected,
      visitor_id: visitorId,
    });
    if (incomingLinkId) {
      track('visitor_answered_after_link', {
        link_id: incomingLinkId,
        question_id: question!.id,
        visitor_id: visitorId,
      });
    }
  };

  const handleNext = () => {
    if (!selected) return;

    if (isLastInCategory && catId) {
      router.push(`/complete/${catId}?voted=${selected}&q=${id}`);
      return;
    }

    if (nextQuestion && catId) {
      if (endsFreeSet) {
        router.push(`/complete/${catId}?voted=${selected}&q=${id}`);
        return;
      }
      if (nextLocked) {
        router.push(`/unlock/${catId}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${catId}&idx=${nextIdx}`);
    } else {
      router.push('/');
    }
  };

  const handleSkip = () => {
    if (nextQuestion && catId) {
      if (nextLocked) {
        router.push(`/unlock/${catId}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${catId}&idx=${nextIdx}`);
    } else {
      router.push('/categories');
    }
  };

  const handleLeaveCategory = () => {
    router.push('/categories');
  };

  // Voluntary pre-answer challenge: share the question before confirming
  const handleChallengeShare = useCallback(async () => {
    const title = 'Would You Rather?';
    const text = `${question?.optionA} — OR — ${question?.optionB}`;
    const { url: shareUrl, linkId } = buildShareUrl(id ?? '', incomingGeneration);

    track('share_clicked', {
      question_id: id,
      surface: 'game_challenge',
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
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopyFeedback('Link copied!');
          setTimeout(() => setCopyFeedback(null), 2000);
        } catch {}
      }
    } else {
      Share.share({ title, message: `${text}\n\n${shareUrl}`, url: shareUrl });
    }
  }, [question, id, incomingGeneration, incomingLinkId, visitorId, setCopyFeedback]);

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
      <PageHead
        title={truncatedTitle}
        description={pageDescription.slice(0, 200)}
        canonicalUrl={`${SITE_URL}/game/${question.id}`}
        imageUrl={`${SITE_URL}/api/card?id=${encodeURIComponent(question.id)}&ratio=1.91x1`}
        twitterCard="summary_large_image"
      />
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

            {nextQuestion && !nextLocked && (
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
                {isLastInCategory || endsFreeSet ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
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
