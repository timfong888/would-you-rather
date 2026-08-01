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
import { QUESTIONS, CATEGORIES, getCategoryQuestions } from '@/constants/questions';
import { COPY } from '@/constants/copy';
import { useThemedStyles } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

const FEATURED_CATEGORIES = CATEGORIES.filter((c) => c.featured);
const TOTAL_QUESTIONS = QUESTIONS.length;

export default function HomeScreen() {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);

  const handleRandomQuestion = () => {
    const freeCats = CATEGORIES.filter((c) => c.tier === 'free');
    const cat = freeCats[Math.floor(Math.random() * freeCats.length)];
    const questions = getCategoryQuestions(cat.id);
    const q = questions[Math.floor(Math.random() * questions.length)];
    router.push(`/game/${q.id}?cat=${cat.id}&idx=${questions.indexOf(q)}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Theme Toggle (floating in top-right for headerless home screen) */}
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appLabel}>The ultimate choice game</Text>
        <Text style={styles.heroTitle}>Would You{'\n'}Rather?</Text>
        <Text style={styles.heroSubtitle}>
          Pick your preference, see how others voted.{'\n'}
          No wrong answers — only interesting ones.
        </Text>

        <View style={styles.audiencePills}>
          <View style={styles.audiencePill}>
            <Text style={styles.audiencePillText}>👨‍👧 Parents & Kids</Text>
          </View>
          <View style={styles.audiencePill}>
            <Text style={styles.audiencePillText}>🔥 Daring Conversations</Text>
          </View>
        </View>

        <View style={styles.heroActions}>
          <Pressable
            onPress={handleRandomQuestion}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>PLAY NOW</Text>
            <Text style={styles.buttonEmoji}>🎲</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/categories')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Browse Categories</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        {[
          { label: 'Questions', value: TOTAL_QUESTIONS.toString() },
          { label: 'Categories', value: CATEGORIES.length.toString() },
          { label: 'Free', value: CATEGORIES.filter(c => c.tier === 'free').length.toString() },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Featured Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>FEATURED</Text>
        </View>
        <View style={styles.featuredGrid}>
          {FEATURED_CATEGORIES.map((cat) => {
            const count = getCategoryQuestions(cat.id).length;
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/categories/${cat.id}`)}
                style={({ pressed }) => [
                  styles.featuredCard,
                  { borderColor: `${cat.color}50`, backgroundColor: `${cat.color}12` },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.featuredEmoji}>{cat.emoji}</Text>
                <Text style={[styles.featuredLabel, { color: cat.color }]}>
                  {cat.label.toUpperCase()}
                </Text>
                <Text style={styles.featuredCount}>{COPY.dilemmaCount(count)}</Text>
                {cat.tier === 'premium' && (
                  <View style={styles.featuredPremiumBadge}>
                    <Text style={styles.featuredPremiumText}>3 FREE</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* All Categories CTA */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ALL CATEGORIES</Text>
          <Pressable onPress={() => router.push('/categories')}>
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        </View>

        <View style={styles.categoryList}>
          {CATEGORIES.map((cat) => {
            const count = getCategoryQuestions(cat.id).length;
            const isPremium = cat.tier === 'premium';
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/categories/${cat.id}`)}
                style={({ pressed }) => [
                  styles.categoryRow,
                  pressed && styles.buttonPressed,
                ]}
              >
                <View style={[styles.categoryRowIcon, { backgroundColor: cat.color }]}>
                  <Text style={styles.categoryRowEmoji}>{cat.emoji}</Text>
                </View>
                <View style={styles.categoryRowContent}>
                  <Text style={styles.categoryRowLabel}>{cat.label.toUpperCase()}</Text>
                  <Text style={styles.categoryRowCount}>{COPY.dilemmaCount(count)}</Text>
                </View>
                {isPremium ? (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                ) : (
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>FREE</Text>
                  </View>
                )}
                <Text style={styles.rowChevron}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.bottomPadding} />
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
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
    },
    topBar: {
      alignItems: 'flex-end',
      marginBottom: SPACING.sm,
    },
    hero: {
      gap: SPACING.md,
      marginBottom: SPACING.xl,
      alignItems: 'flex-start',
    },
    appLabel: {
      color: colors.primary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    heroTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.xxxl,
      fontWeight: FONTS.weights.extrabold,
      lineHeight: 44,
    },
    heroSubtitle: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      lineHeight: 24,
      maxWidth: 340,
    },
    audiencePills: {
      flexDirection: 'row',
      gap: SPACING.sm,
      flexWrap: 'wrap',
      marginTop: SPACING.xs,
    },
    audiencePill: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
    },
    audiencePillText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
    },
    heroActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      flexWrap: 'wrap',
    },
    primaryButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        },
      }),
    },
    primaryButtonText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    buttonEmoji: {
      fontSize: 16,
    },
    secondaryButton: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        },
      }),
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.medium,
    },
    buttonPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.97 }],
    },
    statsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 2,
    },
    statValue: {
      color: colors.text,
      fontSize: FONTS.sizes.xl,
      fontWeight: FONTS.weights.extrabold,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      letterSpacing: 0.5,
    },
    section: {
      marginBottom: SPACING.xl,
      gap: SPACING.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 3,
    },
    seeAll: {
      color: colors.magenta,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
    },
    featuredGrid: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    featuredCard: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      gap: SPACING.xs,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    featuredEmoji: {
      fontSize: 28,
    },
    featuredLabel: {
      fontSize: 10,
      fontWeight: FONTS.weights.extrabold,
      textAlign: 'center',
      letterSpacing: 1,
    },
    featuredCount: {
      color: colors.textMuted,
      fontSize: 10,
    },
    featuredPremiumBadge: {
      backgroundColor: colors.premiumBg,
      borderRadius: RADIUS.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.premium,
    },
    featuredPremiumText: {
      color: colors.premium,
      fontSize: 9,
      fontWeight: FONTS.weights.bold,
    },
    categoryList: {
      gap: SPACING.sm,
    },
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        },
      }),
    },
    categoryRowIcon: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    categoryRowEmoji: {
      fontSize: 22,
    },
    categoryRowContent: {
      flex: 1,
      gap: 2,
    },
    categoryRowLabel: {
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    categoryRowCount: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      letterSpacing: 0.5,
    },
    premiumBadge: {
      backgroundColor: colors.premiumBg,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.premium,
    },
    premiumBadgeText: {
      color: colors.premium,
      fontSize: 9,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 0.5,
    },
    freeBadge: {
      backgroundColor: colors.freeBg,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.free,
    },
    freeBadgeText: {
      color: colors.free,
      fontSize: 9,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 0.5,
    },
    rowChevron: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xl,
    },
    bottomPadding: {
      height: SPACING.xxl,
    },
  });
}
