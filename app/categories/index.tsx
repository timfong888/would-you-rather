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
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>
          Every premium category — free to try. Play 3 questions before you unlock.
        </Text>
      </View>

      {/* Featured Section */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelLine} />
          <Text style={styles.sectionLabel}>FEATURED</Text>
          <View style={styles.sectionLabelLine} />
        </View>

        <View style={styles.featuredRow}>
          {FEATURED.map((cat) => {
            const count = getCategoryQuestions(cat.id).length;
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/categories/${cat.id}`)}
                style={({ pressed }) => [
                  styles.featuredCard,
                  { borderColor: `${cat.color}50`, backgroundColor: `${cat.color}14` },
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Text style={styles.featuredEmoji}>{cat.emoji}</Text>
                <Text style={[styles.featuredName, { color: cat.color }]}>
                  {cat.label.toUpperCase()}
                </Text>
                <Text style={styles.featuredCount}>{count} questions</Text>
                {cat.tier === 'premium' && (
                  <View style={styles.trialBadge}>
                    <Text style={styles.trialBadgeText}>3 FREE</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* All Categories Section */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionLabelLine} />
          <Text style={styles.sectionLabel}>ALL CATEGORIES</Text>
          <View style={styles.sectionLabelLine} />
        </View>

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
                <View style={[styles.rowIconBox, { backgroundColor: `${cat.color}20`, borderColor: `${cat.color}40` }]}>
                  <Text style={styles.rowEmoji}>{cat.emoji}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowName}>{cat.label.toUpperCase()}</Text>
                  <Text style={styles.rowCount}>{count} questions</Text>
                  {isPremium && (
                    <Text style={styles.rowFreeHint}>Free to try — first 3 questions free</Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  {isPremium ? (
                    <View style={styles.premiumPill}>
                      <Text style={styles.premiumPillText}>👑 PREMIUM</Text>
                    </View>
                  ) : (
                    <View style={styles.freePill}>
                      <Text style={styles.freePillText}>✓ FREE</Text>
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
    gap: SPACING.xl,
  },
  header: {
    gap: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  section: {
    gap: SPACING.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2.5,
  },
  featuredRow: {
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
    fontSize: 30,
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
    letterSpacing: 0.3,
  },
  trialBadge: {
    backgroundColor: COLORS.premiumBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.premium,
  },
  trialBadgeText: {
    color: COLORS.premium,
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
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
      },
    }),
  },
  rowIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
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
    letterSpacing: 0.5,
  },
  rowFreeHint: {
    color: COLORS.premium,
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
