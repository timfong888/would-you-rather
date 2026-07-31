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
import { getQuestionById, getCategoryById, getCategoryQuestions } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import VoteBar from '@/components/VoteBar';

export default function ResultsScreen() {
  const { id, voted, cat } = useLocalSearchParams<{ id: string; voted: 'A' | 'B'; cat: string }>();
  const router = useRouter();

  const question = getQuestionById(id);
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

  const catColor = category?.color ?? COLORS.primary;

  const votesA = voted === 'A' ? question.votesA + 1 : question.votesA;
  const votesB = voted === 'B' ? question.votesB + 1 : question.votesB;
  const totalVotes = votesA + votesB;

  const userPickedA = voted === 'A';
  const majorityPickedA = votesA > votesB;
  const withMajority = (userPickedA && majorityPickedA) || (!userPickedA && !majorityPickedA);

  const categoryQuestions = cat ? getCategoryQuestions(cat as CategoryId) : [];
  const currentIdx = categoryQuestions.findIndex((q) => q.id === id);
  const nextQuestion = currentIdx >= 0 && currentIdx < categoryQuestions.length - 1
    ? categoryQuestions[currentIdx + 1]
    : null;

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
        {voted ? (
          <>
            <Text style={styles.resultEmoji}>
              {withMajority ? '🎯' : '🔥'}
            </Text>
            <Text style={styles.resultTitle}>
              {withMajority ? "You're with the majority!" : "You're in the minority!"}
            </Text>
            <Text style={styles.resultSubtitle}>
              {withMajority
                ? `Most people also chose Option ${voted}`
                : `Most people chose Option ${voted === 'A' ? 'B' : 'A'} — you're unique!`}
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
            votes={votesA}
            totalVotes={totalVotes}
            userVoted={voted === 'A'}
          />
          <View style={styles.voteDivider} />
          <VoteBar
            label="B"
            text={question.optionB}
            votes={votesB}
            totalVotes={totalVotes}
            userVoted={voted === 'B'}
          />
        </View>

        {voted && (
          <View style={[
            styles.yourChoice,
            { borderColor: voted === 'A' ? COLORS.optionA : COLORS.optionB },
          ]}>
            <Text style={styles.yourChoiceLabel}>YOUR CHOICE</Text>
            <Text style={[
              styles.yourChoiceOption,
              { color: voted === 'A' ? COLORS.optionA : COLORS.optionB },
            ]}>
              Option {voted} — {voted === 'A' ? question.optionA : question.optionB}
            </Text>
          </View>
        )}

        <Text style={styles.totalVotes}>
          {totalVotes.toLocaleString()} total votes
        </Text>
      </View>

      {/* Share row */}
      <View style={styles.shareRow}>
        <Text style={styles.shareText}>Share this question:</Text>
        <View style={styles.shareButtons}>
          {['𝕏', '📋'].map((icon, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.shareButtonText}>{icon}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.actions}>
        {nextQuestion && cat ? (
          <Pressable
            onPress={() => router.push(`/game/${nextQuestion.id}?cat=${cat}&idx=${currentIdx + 1}`)}
            style={({ pressed }) => [
              styles.nextButton,
              { backgroundColor: catColor },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.nextButtonText}>Next Question →</Text>
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultEmoji: {
    fontSize: 40,
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
    textAlign: 'center',
  },
  resultSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    fontStyle: 'italic',
  },
  voteBars: {
    gap: SPACING.lg,
  },
  voteDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  yourChoice: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  yourChoiceLabel: {
    color: COLORS.textMuted,
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
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shareText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  shareButton: {
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
  shareButtonText: {
    fontSize: 16,
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
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  replayButton: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  replayButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
  },
  homeButton2: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  homeButton2Text: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.md,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
