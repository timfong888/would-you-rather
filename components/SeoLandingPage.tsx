import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { CATEGORIES, QUESTIONS, type Question } from '@/constants/questions';
import { SEO_PAGES, getSeoPage, getSeoPageQuestions } from '@/constants/seoPages';
import { SITE_URL } from '@/constants/config';
import { landingPageJsonLd } from '@/lib/seo';
import PageHead from '@/components/PageHead';
import JsonLd from '@/components/JsonLd';
import { useThemedStyles } from '@/contexts/ThemeContext';

// react-native-web turns role="heading" + aria-level into a real <h1>/<h2>;
// the prop is not in React Native's own Text types.
const h1 = { role: 'heading', 'aria-level': 1 } as object;
const h2 = { role: 'heading', 'aria-level': 2 } as object;

interface SeoLandingPageProps {
  /** Key into SEO_PAGES (constants/seoPages.ts). Everything else comes from there. */
  slug: string;
}

export default function SeoLandingPage({ slug }: SeoLandingPageProps) {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);

  const page = getSeoPage(slug);
  if (!page) return null;
  const questions = getSeoPageQuestions(page);
  const otherPages = SEO_PAGES.filter((p) => p.slug !== page.slug);
  const dilemmaCount = `${Math.floor(QUESTIONS.length / 10) * 10}+`;

  const handlePlay = (question: Question) => {
    router.push(`/game/${question.id}?cat=${question.category}`);
  };

  const handleCtaPlay = () => {
    if (questions.length === 0) return;
    const q = questions[Math.floor(Math.random() * Math.min(questions.length, 5))];
    router.push(`/game/${q.id}?cat=${q.category}`);
  };

  const getCategoryLabel = (catId: string) =>
    CATEGORIES.find((c) => c.id === catId)?.label ?? '';

  const getCategoryEmoji = (catId: string) =>
    CATEGORIES.find((c) => c.id === catId)?.emoji ?? '🎲';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHead
        title={page.title}
        description={page.description}
        canonicalUrl={`${SITE_URL}/${page.slug}`}
      />
      <JsonLd data={landingPageJsonLd(page, questions)} />

      {/* Hero */}
      <View style={styles.hero}>
        <Link href="/" style={styles.appLabel}>Would You Rather?</Link>
        <Text style={styles.heroTitle} {...h1}>{page.headline}</Text>
        <Text style={styles.heroSub}>{page.subheadline}</Text>
        <Pressable
          style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
          onPress={handleCtaPlay}
          accessibilityRole="button"
          accessibilityLabel={page.ctaLabel}
        >
          <Text style={styles.heroCtaText}>{page.ctaLabel}</Text>
        </Pressable>
      </View>

      {/* Question List */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel} {...h2}>SAMPLE QUESTIONS</Text>
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
        <Text style={styles.bottomCtaTitle} {...h2}>
          {dilemmaCount} Dilemmas Across {CATEGORIES.length} Categories
        </Text>
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

      {/* Real <a href> links between the landing pages, so crawlers can find them. */}
      <View style={styles.relatedWrap}>
        <Text style={styles.relatedLabel} {...h2}>MORE QUESTION LISTS</Text>
        {otherPages.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} style={styles.relatedLink}>
            {p.headline}
          </Link>
        ))}
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
    relatedWrap: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.lg,
      alignItems: 'center',
    },
    relatedLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    relatedLink: {
      fontSize: FONTS.sizes.sm,
      color: colors.primary,
      fontWeight: FONTS.weights.semibold,
      paddingVertical: SPACING.xs,
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
