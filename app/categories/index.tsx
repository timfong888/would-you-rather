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
import { CATEGORIES, getCategoryQuestions } from '@/constants/questions';
import { COPY } from '@/constants/copy';

const FEATURED = CATEGORIES.filter((c) => c.featured);
const ALL = CATEGORIES;

export default function CategoriesScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* App Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>WOULD YOU RATHER</Text>
        <Text style={styles.screenTitle}>· SELECT YOUR CATEGORY ·</Text>
      </View>

      {/* Trial Banner */}
      <View style={styles.trialBanner}>
        <Text style={styles.trialBannerText}>{COPY.freeTrialBanner}</Text>
      </View>

      {/* Featured Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>FEATURED</Text>

        <View style={styles.featuredRow}>
          {FEATURED.map((cat) => {
            const count = getCategoryQuestions(cat.id).length;
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/categories/${cat.id}`)}
                style={({ pressed }) => [
                  styles.featuredCard,
                  { borderColor: `${cat.color}40` },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <View style={[styles.featuredIconBox, { backgroundColor: cat.color }]}>
                  <Text style={styles.featuredEmoji}>{cat.emoji}</Text>
                </View>
                <Text style={[styles.featuredName, { color: cat.color }]}>
                  {cat.label.toUpperCase()}
                </Text>
                <Text style={styles.featuredCount}>{COPY.dilemmaCount(count)}</Text>
                {cat.tier === 'premium' && (
                  <Text style={styles.featuredFreeHint}>{COPY.freeTrialHint}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* All Categories Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ALL CATEGORIES</Text>

        <View style={styles.allList}>
          {ALL.map((cat) => {
            const count = getCategoryQuestions(cat.id).length;
            const isPremium = cat.tier === 'premium';
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/categories/${cat.id}`)}
                style={({ pressed }) => [
                  styles.categoryRow,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[styles.rowIconBox, { backgroundColor: cat.color }]}>
                  <Text style={styles.rowEmoji}>{cat.emoji}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{cat.label.toUpperCase()}</Text>
                  <Text style={styles.rowCount}>{COPY.dilemmaCount(count)}</Text>
                  {isPremium && (
                    <Text style={styles.rowFreeHint}>{COPY.freeTrialHint}</Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  {isPremium ? (
                    <View style={styles.premiumPill}>
                      <Text style={styles.premiumPillText}>👑 PREMIUM</Text>
                    </View>
                  ) : (
                    <View style={styles.freePill}>
                      <Text style={styles.freePillText}>🔓 FREE</Text>
                    </View>
                  )}
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ height: SPACING.xxl }} />
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
  },
  header: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
  },
  appTitle: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.black,
    letterSpacing: 4,
    textAlign: 'center',
  },
  screenTitle: {
    color: COLORS.magenta,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  trialBanner: {
    backgroundColor: COLORS.trialBannerBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  trialBannerText: {
    color: COLORS.trialBannerText,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    gap: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.magenta,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 3,
    textAlign: 'center',
  },
  featuredRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  featuredCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    }),
  },
  featuredIconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredEmoji: {
    fontSize: 24,
  },
  featuredName: {
    fontSize: 10,
    fontWeight: FONTS.weights.extrabold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  featuredCount: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.5,
  },
  featuredFreeHint: {
    color: COLORS.magenta,
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 14,
  },
  allList: {
    gap: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
      },
    }),
  },
  rowIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowEmoji: {
    fontSize: 26,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 1,
  },
  rowCount: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.5,
  },
  rowFreeHint: {
    color: COLORS.magenta,
    fontSize: 10,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },
  premiumPill: {
    backgroundColor: COLORS.premiumBg,
    borderWidth: 1,
    borderColor: COLORS.premium,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  premiumPillText: {
    color: COLORS.premium,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
  freePill: {
    backgroundColor: COLORS.freeBg,
    borderWidth: 1,
    borderColor: COLORS.free,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  freePillText: {
    color: COLORS.free,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },
});
