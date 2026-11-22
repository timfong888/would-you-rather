import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getQuestionById, getCategoryById, getCategoryQuestions, getFreeQuestionCount, isQuestionLocked } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import VoteBar from '@/components/VoteBar';
import { useTally } from '@/lib/useTally';
import { INVITE_TITLE, INVITE_TEXT } from '@/lib/results';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { track, buildShareUrl } from '@/lib/analytics';
import { nativeShareOptions } from '@/lib/shareQuestion';
import { shareInvite } from '@/lib/shareInvite';
import { SITE_URL } from '@/constants/config';

export default function ResultsScreen() {
  const { id, voted, cat } = useLocalSearchParams<{ id: string; voted: string; cat: string }>();
  const router = useRouter();
  const { styles, colors } = useThemedStyles(makeStyles);
  const { isUnlocked } = useUnlocked();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const igTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { incomingLinkId, incomingGeneration, visitorId } = useAnalytics();

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      if (igTimerRef.current !== null) clearTimeout(igTimerRef.current);
    };
  }, []);

  const question = getQuestionById(id ?? '');
  const result = useTally(id);
  const safeVoted = voted === 'A' || voted === 'B' ? voted : null;
  const category = cat ? getCategoryById(cat as CategoryId) : undefined;

  if (!question) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Question not found</Text>
        <Pressable onPress={() => router.push('/')} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const catColor = category?.color ?? colors.primary;

  // Real percentages only (server, at or above the vote threshold); otherwise the invite.
  const hasCrowd = result.kind === 'percent';
  const myPct = result.kind === 'percent' && safeVoted ? (safeVoted === 'A' ? result.a : result.b) : null;
  const withMajority = myPct !== null && myPct >= 50;

  const handleShare = useCallback(async () => {
    const title = 'Would You Rather?';
    const text = shareInvite(question?.category);
    const { url: shareUrl, linkId } = buildShareUrl(id ?? '', incomingGeneration);

    track('share_clicked', {
      question_id: id,
      surface: 'results_challenge',
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
        try {
          await navigator.share({ title, text, url: shareUrl });
          return;
        } catch {
          // User cancelled or API unavailable — fall through to clipboard
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopyFeedback('Link copied!');
        copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
      }
    } else {
      Share.share(nativeShareOptions({ title, text, url: shareUrl, os: Platform.OS }));
    }
  }, [question, id, incomingGeneration, incomingLinkId, visitorId]);

  // "Share my take": the same link as a challenge, plus the pick as the `f` code so the
  // recipient sees it only inside the app, after they answer (#188). The preview card
  // and the share text never show the pick.
  const handleShareMyTake = useCallback(async () => {
    if (!safeVoted) return;
    const { url: myTakeUrl, linkId } = buildShareUrl(id ?? '', incomingGeneration, cat === 'kids-family', safeVoted);
    const title = 'My Would You Rather Take';
    const text = shareInvite(question?.category);

    track('share_clicked', {
      question_id: id,
      surface: 'results_my_take',
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
        try {
          await navigator.share({ title, text, url: myTakeUrl });
          return;
        } catch {
          // fall through to clipboard
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${myTakeUrl}`);
        setCopyFeedback('Take copied!');
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    } else {
      Share.share(nativeShareOptions({ title, text, url: myTakeUrl, os: Platform.OS }));
    }
  }, [safeVoted, cat, question, id, incomingGeneration, incomingLinkId, visitorId]);

  const cardUrl9x16 = Platform.select({
    web: typeof window !== 'undefined'
      ? `${window.location.origin}/api/card?id=${id}&ratio=9x16`
      : `/api/card?id=${id}&ratio=9x16`,
    default: `/api/card?id=${id}&ratio=9x16`,
  }) as string;


  const handleInstagramStories = useCallback(() => {
    if (typeof window === 'undefined') return;
    const cardImageUrl = encodeURIComponent(cardUrl9x16);
    window.location.href =
      `instagram-stories://share?backgroundImageURL=${cardImageUrl}`;
    igTimerRef.current = setTimeout(() => {
      handleShare();
    }, 2500);
  }, [cardUrl9x16, handleShare]);

  const categoryHashtags: Record<string, string[]> = {
    'high-life': ['#WouldYouRather', '#TheHighLife', '#Luxury'],
    'moral-compass': ['#WouldYouRather', '#MoralCompass', '#Ethics'],
    'midnight-secrets': ['#WouldYouRather', '#MidnightSecrets', '#DeepQuestions'],
    'social-blunders': ['#WouldYouRather', '#SocialBlunders', '#Awkward'],
    'time-traveler': ['#WouldYouRather', '#TimeTraveler', '#WhatIf'],
    'deep-desires': ['#WouldYouRather', '#DeepDesires', '#LifeChoices'],
    'career-climber': ['#WouldYouRather', '#CareerClimber', '#WorkLife'],
    'tech-dystopia': ['#WouldYouRather', '#TechDystopia', '#AI'],
    'wildest-dreams': ['#WouldYouRather', '#WildestDreams', '#Superpowers'],
    'kids-family': ['#WouldYouRather', '#FamilyGameNight', '#KidsQuestions'],
  };

  const hashtags = cat ? (categoryHashtags[cat] || ['#WouldYouRather']) : ['#WouldYouRather'];

  const handleTikTokShare = useCallback(async () => {
    const title = 'Would You Rather?';
    // TikTok captions don't unfurl a link card, so this one keeps the question (#186).
    const text = `${question?.optionA} — OR — ${question?.optionB}\n\n${hashtags.join(' ')}`;
    const { url: shareUrl, linkId } = buildShareUrl(id ?? '', incomingGeneration);

    track('share_clicked', {
      question_id: id,
      surface: 'results_tiktok',
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
        try {
          await navigator.share({ title, text, url: shareUrl });
          return;
        } catch { /* user cancelled */ }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareUrl}\n\n${hashtags.join(' ')}`);
        setCopyFeedback('Link + hashtags copied!');
        copyTimerRef.current = setTimeout(() => setCopyFeedback(null), 2000);
      }
    } else {
      Share.share(nativeShareOptions({ title, text, url: shareUrl, os: Platform.OS }));
    }
  }, [question, id, incomingGeneration, incomingLinkId, visitorId, hashtags]);

  const categoryQuestions = cat ? getCategoryQuestions(cat as CategoryId) : [];
  const currentIdx = categoryQuestions.findIndex((q) => q.id === id);
  const nextQuestion = currentIdx >= 0 && currentIdx < categoryQuestions.length - 1
    ? categoryQuestions[currentIdx + 1]
    : null;
  // Same routing rule as the game screen: a locked next question goes to the
  // paywall, except the last-free → first-locked step of a free category,
  // which celebrates on the complete screen (with the expansion upsell).
  const nextLocked = !!(category && nextQuestion && isQuestionLocked(category, currentIdx + 1, isUnlocked(category.id)));
  const endsFreeSet = nextLocked && !!category && category.tier === 'free' && currentIdx + 1 === getFreeQuestionCount(category);
  const handleNextQuestion = () => {
    if (!nextQuestion || !cat) return;
    if (endsFreeSet) {
      router.push(`/complete/${cat}?q=${id}${safeVoted ? `&voted=${safeVoted}` : ''}`);
      return;
    }
    if (nextLocked) {
      router.push(`/unlock/${cat}`);
      return;
    }
    router.push(`/game/${nextQuestion.id}?cat=${cat}&idx=${currentIdx + 1}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Category badge */}
      {category && (
        <View style={[styles.categoryBadge, { backgroundColor: `${catColor}20` }]}>
          <Text style={styles.categoryEmoji}>{category.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: catColor }]}>
            {category.label.toUpperCase()}
          </Text>
        </View>
      )}

      {/* Result banner */}
      <View style={styles.resultBanner}>
        {safeVoted ? (
          <>
            <Text style={styles.resultEmoji}>
              {!hasCrowd ? '✨' : withMajority ? '🎯' : '🔥'}
            </Text>
            <Text style={styles.resultTitle}>
              {!hasCrowd ? INVITE_TITLE : withMajority ? "You're with the majority!" : "You're in the minority!"}
            </Text>
            <Text style={styles.resultSubtitle}>
              {!hasCrowd
                ? INVITE_TEXT
                : withMajority
                  ? `Most people also chose Option ${safeVoted}`
                  : `Most people chose Option ${safeVoted === 'A' ? 'B' : 'A'} — you're unique!`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.resultEmoji}>📊</Text>
            <Text style={styles.resultTitle}>See the results</Text>
            <Text style={styles.resultSubtitle}>Here's how everyone voted</Text>
          </>
        )}
      </View>

      {/* Question recap */}
      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>Would you rather...</Text>

        <View style={styles.voteBars}>
          <VoteBar
            label="A"
            text={question.optionA}
            percent={result.kind === 'percent' ? result.a : undefined}
            total={result.kind === 'percent' ? result.total : undefined}
            userVoted={safeVoted === 'A'}
          />
          <View style={styles.voteDivider} />
          <VoteBar
            label="B"
            text={question.optionB}
            percent={result.kind === 'percent' ? result.b : undefined}
            total={result.kind === 'percent' ? result.total : undefined}
            userVoted={safeVoted === 'B'}
          />
        </View>

        {safeVoted && (
          <View style={[
            styles.yourChoice,
            { borderColor: safeVoted === 'A' ? colors.optionA : colors.optionB },
          ]}>
            <Text style={styles.yourChoiceLabel}>YOUR CHOICE</Text>
            <Text style={[
              styles.yourChoiceOption,
              { color: safeVoted === 'A' ? colors.optionA : colors.optionB },
            ]}>
              Option {safeVoted} — {safeVoted === 'A' ? question.optionA : question.optionB}
            </Text>
          </View>
        )}

        <Text style={styles.totalVotes}>
          {result.kind === 'percent'
            ? `${result.total.toLocaleString()} total votes`
            : `${INVITE_TITLE}. ${INVITE_TEXT}`}
        </Text>
      </View>

      {/* Share card */}
      <View style={styles.shareCard}>
        <View style={styles.shareCardHeader}>
          <Text style={styles.shareCardTitle}>Share & Challenge</Text>
          <Text style={styles.shareCardSub}>
            Friends see the question but not the results — they have to play to find out.
          </Text>
        </View>

        {/* Primary: Challenge friends (curiosity gap — result is blurred) */}
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.shareButtonText}>
            {copyFeedback === 'Link copied!' ? 'Link copied!' : '🔗  Challenge friends'}
          </Text>
        </Pressable>
        <Text style={styles.shareButtonHint}>
          They see the question but the result is hidden — they have to play to find out.
        </Text>

        {/* Secondary: Share my take (shows user's choice + position) */}
        {voted && (
          <>
            <Pressable
              onPress={handleShareMyTake}
              style={({ pressed }) => [styles.myTakeButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.myTakeButtonText}>
                {copyFeedback === 'Take copied!' ? 'Take copied!' : `${voted === 'A' ? '🎯' : '🔥'}  Share my take`}
              </Text>
            </Pressable>
            <Text style={styles.shareButtonHint}>
              {myPct !== null
                ? `Show that you're in the ${myPct}% — prove your point.`
                : 'Show which side you chose and spark a debate.'}
            </Text>
          </>
        )}

        {/* Instagram Stories */}
        {Platform.OS === 'web' && (
          <Pressable
            onPress={handleInstagramStories}
            style={({ pressed }) => [styles.igButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.igButtonText}>📸  Instagram Stories</Text>
          </Pressable>
        )}

        {/* TikTok share — includes category hashtags */}
        <Pressable
          onPress={handleTikTokShare}
          style={({ pressed }) => [styles.igButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.igButtonText}>🎵  TikTok</Text>
        </Pressable>

        <Text style={styles.shareLink} numberOfLines={1}>
          {Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/p/${id}`
            : `${SITE_URL}/p/${id}`}
        </Text>
      </View>

      {/* Navigation */}
      <View style={styles.actions}>
        {nextQuestion && cat ? (
          <Pressable
            onPress={handleNextQuestion}
            style={({ pressed }) => [
              styles.nextButton,
              { backgroundColor: catColor },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.nextButtonText}>{endsFreeSet ? 'See Results →' : 'Next Question →'}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/categories')}
            style={({ pressed }) => [
              styles.nextButton,
              { backgroundColor: catColor },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.nextButtonText}>Explore Categories →</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push(`/game/${id}${cat ? `?cat=${cat}&idx=${currentIdx}` : ''}`)}
          style={({ pressed }) => [
            styles.replayButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.replayButtonText}>Change my answer</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/')}
          style={({ pressed }) => [
            styles.homeButton2,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.homeButton2Text}>Back to Home</Text>
        </Pressable>
      </View>
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
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    resultBanner: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultEmoji: {
      fontSize: 40,
    },
    resultTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.extrabold,
      textAlign: 'center',
    },
    resultSubtitle: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      textAlign: 'center',
      lineHeight: 22,
    },
    questionCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    questionLabel: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontStyle: 'italic',
    },
    voteBars: {
      gap: SPACING.lg,
    },
    voteDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    yourChoice: {
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    yourChoiceLabel: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    yourChoiceOption: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      lineHeight: 18,
    },
    totalVotes: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
    },
    shareCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.sm,
    },
    shareCardHeader: {
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    shareCardTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    shareCardSub: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      lineHeight: 16,
    },
    shareButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    shareButtonText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    shareButtonHint: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      textAlign: 'center',
      lineHeight: 16,
      marginTop: -SPACING.xs,
    },
    myTakeButton: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.primary,
      marginTop: SPACING.xs,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    myTakeButtonText: {
      color: colors.primary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    igButton: {
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    igButtonText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.medium,
    },
    shareLink: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    actions: {
      gap: SPACING.sm,
    },
    nextButton: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
      }),
    },
    nextButtonText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.bold,
    },
    replayButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
    replayButtonText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.medium,
    },
    homeButton2: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    homeButton2Text: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.md,
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
  });
}
