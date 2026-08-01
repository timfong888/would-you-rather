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
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import { QUESTIONS, CATEGORIES, getCategoryQuestions, CategoryId, FAMILY_FRIENDLY, DARING } from '@/constants/questions';
import { COPY } from '@/constants/copy';

const FEATURED_CATEGORIES = CATEGORIES.filter((c) => c.featured);
const TOTAL_QUESTIONS = QUESTIONS.length;

export default function HomeScreen() {
  const router = useRouter();

  const navigateToQuestion = (cat: typeof CATEGORIES[number], questions: ReturnType<typeof getCategoryQuestions>) => {
    const q = questions[Math.floor(Math.random() * questions.length)];
    router.push(`/game/${q.id}?cat=${cat.id}&idx=${questions.indexOf(q)}`);
  };

  const handleRandomQuestion = () => {
    const freeCats = CATEGORIES.filter((c) => c.tier === 'free');
    const cat = freeCats[Math.floor(Math.random() * freeCats.length)];
    const questions = getCategoryQuestions(cat.id);
    navigateToQuestion(cat, questions);
  };

  const handleQuickPlay = (categoryIds: CategoryId[]) => {
    const cats = CATEGORIES.filter((c) => categoryIds.includes(c.id));
    if (!cats.length) return;
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const questions = getCategoryQuestions(cat.id);
    if (!questions.length) return;
    navigateToQuestion(cat, questions);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.appLabel}>The ultimate choice game</Text>
        <Text style={styles.heroTitle}>Would You{'\n'}Rather?</Text>
        <Text style={styles.heroSubtitle}>
          Pick your preference, see how others voted.{'\n'}
          No wrong answers — only interesting ones.
        </Text>

        <View style={styles.quickPlaySection}>
          <Text style={styles.quickPlayLabel}>QUICK PLAY</Text>
          <View style={styles.audiencePills}>
            <Pressable
              onPress={() => handleQuickPlay(FAMILY_FRIENDLY)}
              style={({ pressed }) => [
                styles.audiencePill,
                pressed && styles.audiencePillPressed,
              ]}
            >
              <Text style={styles.audiencePillText}>👨‍👧 Parents & Kids</Text>
              <Text style={styles.audiencePillHint}>▶</Text>
            </Pressable>
            <Pressable
              onPress={() => handleQuickPlay(DARING)}
              style={({ pressed }) => [
                styles.audiencePill,
                styles.audiencePillDaring,
                pressed && styles.audiencePillPressed,
              ]}
            >
              <Text style={styles.audiencePillText}>🔥 Daring</Text>
              <Text style={styles.audiencePillHint}>▶</Text>
            </Pressable>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
  },
  hero: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    alignItems: 'flex-start',
  },
  appLabel: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.extrabold,
    lineHeight: 44,
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    lineHeight: 24,
    maxWidth: 340,
  },
  quickPlaySection: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  quickPlayLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 2,
  },
  audiencePills: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
    }),
  },
  audiencePillDaring: {
    borderColor: COLORS.daringAccent,
    backgroundColor: COLORS.daringBg,
  },
  audiencePillPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  audiencePillText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  audiencePillHint: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: COLORS.magenta,
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
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  buttonEmoji: {
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
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
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  statValue: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.extrabold,
  },
  statLabel: {
    color: COLORS.textMuted,
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
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 3,
  },
  seeAll: {
    color: COLORS.magenta,
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
    color: COLORS.textMuted,
    fontSize: 10,
  },
  featuredPremiumBadge: {
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.premium,
  },
  featuredPremiumText: {
    color: COLORS.premium,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
  },
  categoryList: {
    gap: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1,
  },
  categoryRowCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 0.5,
  },
  premiumBadge: {
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.premium,
  },
  premiumBadgeText: {
    color: COLORS.premium,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  freeBadge: {
    backgroundColor: COLORS.freeBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.free,
  },
  freeBadgeText: {
    color: COLORS.free,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  rowChevron: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xl,
  },
  bottomPadding: {
    height: SPACING.xxl,
  },
});
