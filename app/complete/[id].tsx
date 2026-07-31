import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import {
  getCategoryById,
  getCategoryQuestions,
  getQuestionById,
  FREE_TRIAL_COUNT,
} from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';

export default function CompleteScreen() {
  const { id, voted, q } = useLocalSearchParams<{ id: string; voted: 'A' | 'B'; q: string }>();
  const router = useRouter();
  const anim = useRef(new Animated.Value(0)).current;

  const category = getCategoryById(id as CategoryId);
  const questions = getCategoryQuestions(id as CategoryId);
  const lastQuestion = q ? getQuestionById(q) : questions[questions.length - 1];

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

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
  const completedCount = category.tier === 'premium' ? FREE_TRIAL_COUNT : questions.length;
  const remaining = questions.length - completedCount;
  const isPremium = category.tier === 'premium';

  // Compute final question results
  const votesA = lastQuestion ? (voted === 'A' ? lastQuestion.votesA + 1 : lastQuestion.votesA) : 0;
  const votesB = lastQuestion ? (voted === 'B' ? lastQuestion.votesB + 1 : lastQuestion.votesB) : 0;
  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;
  const myChoice = voted;
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

            {/* Option A */}
            <View style={[
              styles.resultOption,
              myChoice === 'A' && { borderColor: COLORS.optionA, backgroundColor: `${COLORS.optionA}15` },
            ]}>
              <View style={styles.resultOptionTop}>
                <View style={[styles.optionBadge, { backgroundColor: COLORS.optionA }]}>
                  <Text style={styles.optionBadgeText}>A</Text>
                </View>
                <Text style={styles.resultOptionText} numberOfLines={2}>
                  {lastQuestion.optionA}
                </Text>
              </View>
              <View style={styles.resultStats}>
                {myChoice === 'A' && (
                  <View style={styles.yourChoiceTag}>
                    <Text style={styles.yourChoiceTagText}>YOUR CHOICE</Text>
                  </View>
                )}
                <Text style={[styles.resultPct, { color: COLORS.optionA }]}>{pctA}%</Text>
                <Text style={styles.globalVoteLabel}>GLOBAL VOTE</Text>
              </View>
              <View style={styles.resultBar}>
                <View style={[styles.resultBarFill, { backgroundColor: COLORS.optionA, width: `${pctA}%` as any }]} />
              </View>
            </View>

            <View style={styles.orRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Option B */}
            <View style={[
              styles.resultOption,
              myChoice === 'B' && { borderColor: COLORS.optionB, backgroundColor: `${COLORS.optionB}15` },
            ]}>
              <View style={styles.resultOptionTop}>
                <View style={[styles.optionBadge, { backgroundColor: COLORS.optionB }]}>
                  <Text style={styles.optionBadgeText}>B</Text>
                </View>
                <Text style={styles.resultOptionText} numberOfLines={2}>
                  {lastQuestion.optionB}
                </Text>
              </View>
              <View style={styles.resultStats}>
                {myChoice === 'B' && (
                  <View style={[styles.yourChoiceTag, { borderColor: COLORS.optionB }]}>
                    <Text style={[styles.yourChoiceTagText, { color: COLORS.optionB }]}>YOUR CHOICE</Text>
                  </View>
                )}
                <Text style={[styles.resultPct, { color: COLORS.optionB }]}>{pctB}%</Text>
                <Text style={styles.globalVoteLabel}>GLOBAL VOTE</Text>
              </View>
              <View style={styles.resultBar}>
                <View style={[styles.resultBarFill, { backgroundColor: COLORS.optionB, width: `${pctB}%` as any }]} />
              </View>
            </View>

            <Text style={styles.totalVotesText}>{totalVotes.toLocaleString()} total votes</Text>

            {/* Majority verdict */}
            <View style={[styles.verdictRow, { borderColor: withMajority ? COLORS.success : COLORS.secondary }]}>
              <Text style={styles.verdictEmoji}>{withMajority ? '🎯' : '🔥'}</Text>
              <Text style={[styles.verdictText, { color: withMajority ? COLORS.success : COLORS.secondary }]}>
                {withMajority
                  ? `You're with the majority! (${myPct}% agreed)`
                  : `You're in the minority — uniquely you! (${myPct}% chose Option ${myChoice})`}
              </Text>
            </View>
          </View>
        )}

        {/* Share Row */}
        <View style={styles.shareRow}>
          <Text style={styles.shareLabel}>Share this result:</Text>
          <View style={styles.shareButtons}>
            <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.shareBtnText}>𝕏</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}>
              <Text style={styles.shareBtnText}>📋</Text>
            </Pressable>
          </View>
        </View>

        {/* Premium Upsell Card (loss aversion) */}
        {isPremium && remaining > 0 && (
          <Pressable
            onPress={() => router.push(`/unlock/${id}`)}
            style={({ pressed }) => [
              styles.upsellCard,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.upsellTop}>
              <Text style={styles.upsellIcon}>👑</Text>
              <View style={styles.upsellTextBlock}>
                <Text style={styles.upsellTitle}>THE DEPTHS AWAIT</Text>
                <Text style={styles.upsellHook}>
                  {remaining} questions remain unfinished in {category.label}
                </Text>
              </View>
            </View>
            <Text style={styles.upsellDesc}>
              You've only scratched the surface. Unlock the full collection and see how the world truly divides.
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
  homeButton: {
    backgroundColor: COLORS.magenta,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  homeButtonText: {
    color: COLORS.text,
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
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 2,
    fontWeight: FONTS.weights.bold,
  },
  resultsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultsCardLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  resultOption: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  resultOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBadgeText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
  },
  resultOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    lineHeight: 20,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  yourChoiceTag: {
    borderWidth: 1,
    borderColor: COLORS.optionA,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  yourChoiceTagText: {
    color: COLORS.optionA,
    fontSize: 9,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1,
  },
  resultPct: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
    marginLeft: 'auto' as any,
  },
  globalVoteLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1,
  },
  resultBar: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  resultBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  orText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 2,
  },
  totalVotesText: {
    color: COLORS.textMuted,
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
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  shareBtn: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.md,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  shareBtnText: {
    fontSize: 16,
  },
  upsellCard: {
    backgroundColor: '#0D0D18',
    borderWidth: 1.5,
    borderColor: COLORS.premium,
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
    color: COLORS.premium,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  upsellHook: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
    lineHeight: 22,
  },
  upsellDesc: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  upsellCta: {
    backgroundColor: COLORS.premium,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  upsellCtaText: {
    color: '#0F0F1A',
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
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  homeLink: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  homeLinkText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },
});
