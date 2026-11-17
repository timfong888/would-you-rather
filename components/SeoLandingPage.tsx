import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { CATEGORIES, QUESTIONS, type Question } from '@/constants/questions';
import { getRelatedSeoPages, getSeoPage, getSeoPageQuestions, type SeoPageDef } from '@/constants/seoPages';
import { SITE_URL } from '@/constants/config';
import { landingPageJsonLd } from '@/lib/seo';
import { track, buildShareUrl } from '@/lib/analytics';
import PageHead from '@/components/PageHead';
import JsonLd from '@/components/JsonLd';
import { useThemedStyles } from '@/contexts/ThemeContext';

// react-native-web turns role="heading" + aria-level into a real <h1>/<h2>;
// the prop is not in React Native's own Text types.
const h1 = { role: 'heading', 'aria-level': 1 } as object;
const h2 = { role: 'heading', 'aria-level': 2 } as object;
const h3 = { role: 'heading', 'aria-level': 3 } as object;

const PERSONA_HEADING: Record<SeoPageDef['persona'], string> = {
  parents: 'MORE FOR FAMILIES',
  couples: 'MORE FOR COUPLES',
  groups: 'MORE FOR GROUPS',
};

interface SeoLandingPageProps {
  /** Key into SEO_PAGES (constants/seoPages.ts). Everything else comes from there. */
  slug: string;
}

/**
 * Template for every SEO landing page. Order, top to bottom:
 * hero + one-tap play → intro → the questions (each playable and shareable)
 * → how to play / parent tips → explore CTA → links to the persona's other pages.
 * Copy lives in constants/seoPages.ts; the process is docs/seo-content-skill.md.
 */
export default function SeoLandingPage({ slug }: SeoLandingPageProps) {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const [sharedId, setSharedId] = useState<string | null>(null);

  const page = getSeoPage(slug);
  if (!page) return null;
  const questions = getSeoPageQuestions(page);
  const { samePersona, other } = getRelatedSeoPages(page);
  const dilemmaCount = `${Math.floor(QUESTIONS.length / 10) * 10}+`;
  const primaryCategory = CATEGORIES.find((c) => c.id === page.categoryIds[0]);

  const gameHref = (q: Question) => `/game/${q.id}?cat=${q.category}`;

  const handleCtaPlay = () => {
    if (questions.length === 0) return;
    const q = questions[Math.floor(Math.random() * Math.min(questions.length, 5))];
    track('seo_cta_clicked', { slug: page.slug, persona: page.persona, funnel: page.funnel, question_id: q.id });
    router.push(gameHref(q) as never);
  };

  const handleShare = async (q: Question) => {
    const { url, linkId } = buildShareUrl(q.id, 0);
    track('share_clicked', { question_id: q.id, surface: 'seo_landing', slug: page.slug, link_id: linkId });
    const text = `Would you rather ${q.optionA.toLowerCase()} or ${q.optionB.toLowerCase()}?`;
    if (Platform.OS !== 'web') {
      // Native app routes: the OS share sheet.
      try {
        await Share.share({ title: 'Would You Rather?', message: `${text}\n\n${url}`, url });
      } catch {
        // Dismissed or unavailable: nothing else to do.
      }
      return;
    }
    if (typeof navigator === 'undefined') return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Would You Rather?', text, url });
        return;
      } catch {
        // Cancelled or unavailable: fall through to copying the link.
      }
    }
    try {
      await navigator.clipboard?.writeText(`${text} ${url}`);
      setSharedId(q.id);
      setTimeout(() => setSharedId((id) => (id === q.id ? null : id)), 2000);
    } catch {
      // Clipboard blocked: nothing else to do.
    }
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
        imageUrl={questions[0] ? `${SITE_URL}/api/card?id=${questions[0].id}&ratio=1.91x1` : undefined}
      />
      <JsonLd data={landingPageJsonLd(page, questions)} />

      <View style={styles.column}>
        {/* Hero */}
        <View style={styles.hero}>
          <Link href="/" style={styles.appLabel}>Would You Rather?</Link>
          <Text style={styles.heroTitle} {...h1}>{page.headline}</Text>
          <Text style={styles.heroSub}>{page.subheadline}</Text>
          {page.bestFor ? <Text style={styles.bestFor}>{page.bestFor}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
            onPress={handleCtaPlay}
            accessibilityRole="button"
            accessibilityLabel={page.ctaLabel}
          >
            <Text style={styles.heroCtaText}>{page.ctaLabel}</Text>
          </Pressable>
          <Text style={styles.heroNote}>Free · no sign-up · nothing to install</Text>
        </View>

        {/* Intro */}
        {page.intro?.length ? (
          <View style={styles.section}>
            {page.intro.map((para, i) => (
              <Text key={i} style={styles.introText}>{para}</Text>
            ))}
          </View>
        ) : null}

        {/* Question List */}
        <View style={styles.section}>
          <Text style={styles.listHeading} {...h2}>{page.listHeading ?? 'Sample Questions'}</Text>
          {questions.map((q, i) => {
            const totalVotes = q.votesA + q.votesB;
            const pctA = totalVotes > 0 ? Math.round((q.votesA / totalVotes) * 100) : 0;
            const leadPct = Math.max(pctA, 100 - pctA);

            return (
              <View key={q.id} style={styles.card}>
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>
                    {getCategoryEmoji(q.category)} {getCategoryLabel(q.category).toUpperCase()}
                  </Text>
                  <Text style={styles.cardNumber}>#{i + 1}</Text>
                </View>
                {/* One heading per question: "Would you rather A — or — B" */}
                <Text style={styles.options} {...h3}>
                  <Text style={styles.cardQuestion}>Would you rather…{'\n'}</Text>
                  <Text style={styles.optionA}>{q.optionA}</Text>
                  <Text style={styles.orDivider}>{'\n'}— OR —{'\n'}</Text>
                  <Text style={styles.optionB}>{q.optionB}</Text>
                </Text>
                {totalVotes >= 5 && (
                  <Text style={styles.cardVoteHint}>
                    {leadPct}% chose one side — play to see which
                  </Text>
                )}
                <View style={styles.cardActions}>
                  <Link
                    href={gameHref(q) as never}
                    style={styles.cardCta}
                    onPress={() => track('seo_question_clicked', { slug: page.slug, question_id: q.id })}
                  >
                    Play this one →
                  </Link>
                  <Pressable
                    onPress={() => handleShare(q)}
                    accessibilityRole="button"
                    accessibilityLabel="Share this question"
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.shareText}>{sharedId === q.id ? 'Link copied ✓' : 'Share ↗'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* How to play / tips */}
        {page.tips?.length ? (
          <View style={styles.section}>
            <Text style={styles.listHeading} {...h2}>How to Play</Text>
            {page.tips.map((tip) => (
              <View key={tip.title} style={styles.tip}>
                <Text style={styles.tipTitle} {...h3}>{tip.title}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Bottom CTA */}
        <View style={styles.bottomCta}>
          <Text style={styles.bottomCtaTitle} {...h2}>
            {dilemmaCount} Dilemmas Across {CATEGORIES.length} Categories
          </Text>
          <Text style={styles.bottomCtaDesc}>
            {page.persona === 'parents'
              ? 'Start with the free Kids & Family pack: written for ages 4 to 11, no sign-up, nothing to install.'
              : 'Family-friendly packs, daring conversation starters for couples, and everything in between. Free to start, no account required.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.85 }]}
            onPress={handleCtaPlay}
            accessibilityRole="button"
          >
            <Text style={styles.heroCtaText}>{page.ctaLabel}</Text>
          </Pressable>
          {primaryCategory ? (
            <Link href={`/categories/${primaryCategory.id}` as never} style={styles.secondaryLink}>
              Browse all {primaryCategory.label} questions
            </Link>
          ) : null}
        </View>

        {/* Real <a href> links between the landing pages, so crawlers can find them. */}
        {samePersona.length ? (
          <View style={styles.relatedWrap}>
            <Text style={styles.relatedLabel} {...h2}>{PERSONA_HEADING[page.persona]}</Text>
            {samePersona.map((p) => (
              <Link key={p.slug} href={`/${p.slug}` as never} style={styles.relatedLink}>
                {p.headline}
              </Link>
            ))}
          </View>
        ) : null}
        {other.length ? (
          <View style={styles.relatedWrap}>
            <Text style={styles.relatedLabel} {...h2}>MORE QUESTION LISTS</Text>
            {other.map((p) => (
              <Link key={p.slug} href={`/${p.slug}` as never} style={styles.relatedLink}>
                {p.headline}
              </Link>
            ))}
          </View>
        ) : null}
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
    column: {
      width: '100%',
      maxWidth: 680,
      alignSelf: 'center',
    },
    bestFor: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: SPACING.lg,
    },
    heroNote: {
      fontSize: FONTS.sizes.xs,
      color: colors.textMuted,
      marginTop: SPACING.sm,
    },
    introText: {
      fontSize: FONTS.sizes.md,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: SPACING.md,
    },
    listHeading: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.black,
      color: colors.text,
      marginTop: SPACING.md,
      marginBottom: SPACING.md,
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    shareBtn: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      minHeight: 32,
      justifyContent: 'center',
    },
    shareText: {
      fontSize: FONTS.sizes.sm,
      color: colors.textSecondary,
      fontWeight: FONTS.weights.semibold,
    },
    tip: {
      marginBottom: SPACING.md,
    },
    tipTitle: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    tipBody: {
      fontSize: FONTS.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    secondaryLink: {
      fontSize: FONTS.sizes.sm,
      color: colors.primary,
      fontWeight: FONTS.weights.semibold,
      marginTop: SPACING.md,
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
      lineHeight: 26,
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
