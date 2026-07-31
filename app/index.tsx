import React, { useState } from 'react';
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
import { QUESTIONS, CATEGORIES, getQuestionsByCategory } from '@/constants/questions';
import CategoryCard from '@/components/CategoryCard';
import QuestionCard from '@/components/QuestionCard';

export default function HomeScreen() {
  const router = useRouter();
  const featuredQuestions = QUESTIONS.slice(0, 3);

  const handleRandomQuestion = () => {
    const random = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    router.push(`/game/${random.id}`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.tagline}>The ultimate choice game</Text>
        </View>
        <Text style={styles.heroTitle}>Would You{'\n'}Rather?</Text>
        <Text style={styles.heroSubtitle}>
          Pick your preference, see how others voted. No wrong answers — only interesting ones.
        </Text>

        <View style={styles.heroActions}>
          <Pressable
            onPress={handleRandomQuestion}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Play Now</Text>
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
          { label: 'Questions', value: QUESTIONS.length.toString() },
          { label: 'Categories', value: CATEGORIES.length.toString() },
          { label: 'Total Votes', value: '12.4k' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Categories Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable onPress={() => router.push('/categories')}>
            <Text style={styles.seeAll}>See all →</Text>
          </Pressable>
        </View>

        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.categoryItem}>
              <CategoryCard
                id={cat.id}
                label={cat.label}
                emoji={cat.emoji}
                color={cat.color}
                questionCount={getQuestionsByCategory(cat.id).length}
                onPress={() => router.push(`/categories/${cat.id}`)}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Featured Questions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Questions</Text>
          <Text style={styles.sectionEmoji}>🔥</Text>
        </View>

        <View style={styles.questionList}>
          {featuredQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
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
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagline: {
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
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
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
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  buttonEmoji: {
    fontSize: 18,
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
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },
  sectionEmoji: {
    fontSize: 20,
  },
  seeAll: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryItem: {
    width: '48%',
    ...Platform.select({
      web: {
        width: 'calc(33.33% - 6px)',
        minWidth: 140,
      },
    }),
  },
  questionList: {
    gap: SPACING.md,
  },
  bottomPadding: {
    height: SPACING.xxl,
  },
});
