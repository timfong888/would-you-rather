import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { type Question, type CategoryDef } from '@/constants/questions';
import { SITE_URL } from '@/constants/config';
import PageHead from '@/components/PageHead';
import { useThemedStyles } from '@/contexts/ThemeContext';

interface SeoLandingPageProps {
  slug: string;
  pageTitle: string;
  pageDescription: string;
  headline: string;
  subheadline: string;
  questions: Question[];
  categories: CategoryDef[];
  ctaLabel?: string;
  ctaCategory?: string;
}

export default function SeoLandingPage({
  slug,
  pageTitle,
  pageDescription,
  headline,
  subheadline,
  questions,
  categories,
  ctaLabel = 'Play Free Now →',
  ctaCategory,
}: SeoLandingPageProps) {
  const router = useRouter();
  const { styles, colors } = useThemedStyles(makeStyles);

  const handlePlay = (question: Question) => {
    router.push(`/game/${question.id}?cat=${question.category}`);
  };

  const handleCtaPlay = () => {
    if (questions.length === 0) return;
    const q = questions[Math.floor(Math.random() * Math.min(questions.length, 5))];
    router.push(`/game/${q.id}?cat=${q.category}`);
  };

  const getCategoryLabel = (catId: string) =>
    categories.find((c) => c.id === catId)?.label ?? '';

  const getCategoryEmoji = (catId: string) =>
    categories.find((c) => c.id === catId)?.emoji ?? '🎲';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={`${SITE_URL}/${slug}`}
      />

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appLabel}>Would You Rather?</Text>
        <Text style={styles.heroTitle}>{headline}</Text>
        <Text style={styles.heroSub}>{subheadline}</Text>
        <Pressable
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
          onPress={handleCtaPlay}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.heroCtaText}>{ctaLabel}</Text>
        </Pressable>
      </View>

      {/* Question List */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SAMPLE QUESTIONS</Text>
        {questions.map((q, i) => {
          const totalVotes = q.votesA + q.votesB;
          const pctA = totalVotes > 0 ? Math.round((q.votesA / totalVotes) * 100) : 0;
          const pctB = 100 - pctA;
          const leadOption = pctA >= pctB ? 'A' : 'B';
          const leadPct = leadOption === 'A' ? pctA : pctB;

          return (
            <Pressable
              key={q.id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => handlePlay(q)}
              accessibilityRole="button"
              accessibilityLabel={`Play: Would you rather ${q.optionA} or ${q.optionB}?`}
            >
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>
                  {getCategoryEmoji(q.category)} {getCategoryLabel(q.category).toUpperCase()}
                </Text>
                <Text style={styles.cardNumber}>#{i + 1}</Text>
              </View>
              <Text style={styles.cardQuestion}>
                Would you rather...
              </Text>
              <View style={styles.options}>
                <Text style={styles.optionA}>{q.optionA}</Text>
                <Text style={styles.orDivider}>— OR —</Text>
                <Text style={styles.optionB}>{q.optionB}</Text>
              </View>
              {totalVotes >= 5 && (
                <Text style={styles.cardVoteHint}>
                  {leadPct}% chose one side — play to see which
                </Text>
              )}
              <Text style={styles.cardCta}>Tap to answer →</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
        <Text style={styles.bottomCtaTitle}>180+ Dilemmas Across 9 Categories</Text>
        <Text style={styles.bottomCtaDesc}>
          Family-friendly packs, daring conversation starters for couples,
          and everything in between. Free to start, no account required.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/')}
          accessibilityRole="button"
        >
          <Text style={styles.heroCtaText}>Explore All Categories →</Text>
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
      paddingBottom: SPACING.xxl,
    },
    hero: {
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xxl,
      paddingBottom: SPACING.xl,
    },
    appLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 3,
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: SPACING.sm,
    },
    heroTitle: {
      fontSize: Platform.OS === 'web' ? 32 : FONTS.sizes.xxxl,
      fontWeight: FONTS.weights.black,
      color: colors.text,
      textAlign: 'center',
      lineHeight: Platform.OS === 'web' ? 40 : 44,
      marginBottom: SPACING.sm,
    },
    heroSub: {
      fontSize: FONTS.sizes.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: SPACING.lg,
      maxWidth: 480,
    },
    heroCta: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    heroCtaText: {
      color: colors.textOnColor,
      fontWeight: FONTS.weights.bold,
      fontSize: FONTS.sizes.md,
    },
    section: {
      paddingHorizontal: SPACING.lg,
    },
    sectionLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
      color: colors.textMuted,
      marginBottom: SPACING.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardBadge: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    cardBadgeText: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 1,
      color: colors.textMuted,
    },
    cardNumber: {
      fontSize: FONTS.sizes.xs,
      color: colors.textMuted,
    },
    cardQuestion: {
      fontSize: FONTS.sizes.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    options: {
      marginBottom: SPACING.sm,
    },
    optionA: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      color: colors.optionA,
      marginBottom: SPACING.xs,
    },
    orDivider: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
      color: colors.textMuted,
      marginVertical: SPACING.xs,
    },
    optionB: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      color: colors.optionB,
    },
    cardVoteHint: {
      fontSize: FONTS.sizes.xs,
      color: colors.textMuted,
      marginBottom: SPACING.xs,
    },
    cardCta: {
      fontSize: FONTS.sizes.sm,
      color: colors.primary,
      fontWeight: FONTS.weights.semibold,
    },
    bottomCta: {
      margin: SPACING.lg,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    bottomCtaTitle: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.black,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    bottomCtaDesc: {
      fontSize: FONTS.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: SPACING.lg,
    },
  });
}
