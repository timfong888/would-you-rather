import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import { getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import { COPY } from '@/constants/copy';
import type { CategoryId } from '@/constants/questions';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IoniconsName; text: string }[] = [
  { icon: 'chatbubbles-outline', text: '20 exclusive hand-picked dilemmas' },
  { icon: 'stats-chart-outline', text: 'Global real-time voter statistics' },
  { icon: 'infinite-outline', text: 'Permanent library access — own it forever' },
  { icon: 'ban-outline', text: 'Ad-free category experience' },
];

export default function UnlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const category = getCategoryById(id as CategoryId);
  const questions = getCategoryQuestions(id as CategoryId);

  if (!category) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top + SPACING.lg }]}>
        <Text style={styles.errorText}>Category not found</Text>
        <Pressable onPress={() => router.push('/categories')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Browse Categories</Text>
        </Pressable>
      </View>
    );
  }

  const teaserQuestions = questions.slice(FREE_TRIAL_COUNT, FREE_TRIAL_COUNT + 3);
  const remainingCount = Math.max(questions.length - (FREE_TRIAL_COUNT + teaserQuestions.length), 0);

  const handleUnlock = () => {
    // RevenueCat integration point: replace with Purchases.purchasePackage()
    // Price should bind to Package.storeProduct.priceString (not hardcoded)
    Alert.alert(
      'Premium Unlock',
      `Connect RevenueCat to enable real purchases for "${category.label}" ($2.99).`,
    );
  };

  const handleRestorePurchases = () => {
    // RevenueCat integration point: replace with Purchases.restorePurchases()
    Alert.alert('Restore Purchases', 'Connect RevenueCat to restore prior purchases.');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + SPACING.sm,
          paddingBottom: insets.bottom + SPACING.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Close Button */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.closeBtn,
          pressed && { opacity: 0.6 },
        ]}
        hitSlop={12}
        accessibilityLabel="Close"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={COLORS.textSecondary} />
      </Pressable>

      {/* Premium Badge */}
      <View style={styles.badgeContainer}>
        <View style={[styles.diamondFrame, { borderColor: category.color }]}>
          <Text style={styles.badgeEmoji}>👑</Text>
        </View>
        <View style={[styles.premiumLabel, { borderColor: category.color }]}>
          <Text style={[styles.premiumLabelText, { color: category.color }]}>
            PREMIUM ACCESS
          </Text>
        </View>
      </View>

      {/* Headline */}
      <View style={styles.headlineBlock}>
        <Text style={styles.headline}>UNFOLD THE FULL COLLECTION</Text>
        <Text style={styles.subheadline}>
          You've tasted the first three. The journey into{' '}
          <Text style={[styles.categoryNameInline, { color: category.color }]}>
            "{category.label}"
          </Text>
          {' '}has only just begun.
        </Text>
        <Text style={styles.lossAversion}>
          {questions.length - FREE_TRIAL_COUNT} dilemmas remain locked. Will you leave them unanswered?
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>WHAT YOU GET</Text>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <Ionicons
              name={b.icon}
              size={20}
              color={COLORS.textSecondary}
              style={styles.benefitIconStyle}
            />
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {/* Price + CTA */}
      <View style={styles.priceBlock}>
        <Text style={styles.price}>$2.99</Text>
        <Text style={styles.priceNote}>ONE-TIME CATEGORY UNLOCK · NO SUBSCRIPTION</Text>
      </View>

      <Pressable
        onPress={handleUnlock}
        style={({ pressed }) => [
          styles.unlockBtn,
          { backgroundColor: category.color },
          pressed && styles.btnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Unlock ${questions.length} dilemmas for $2.99`}
      >
        <Text style={styles.unlockBtnText}>UNLOCK {COPY.dilemmaCount(questions.length)} →</Text>
      </Pressable>

      <Pressable
        onPress={handleRestorePurchases}
        style={({ pressed }) => [
          styles.restoreBtn,
          pressed && { opacity: 0.6 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Restore previous purchases"
      >
        <Text style={styles.restoreBtnText}>Restore Purchases</Text>
      </Pressable>

      {/* Category preview teaser */}
      <View style={styles.teaserSection}>
        <Text style={styles.teaserLabel}>WHAT AWAITS</Text>
        <Text style={styles.teaserSubtitle}>A glimpse of what remains locked:</Text>
        <View style={styles.teaserList}>
          {teaserQuestions.map((q, i) => (
            <View key={q.id} style={styles.teaserItem}>
              <Text style={styles.teaserNum}>{FREE_TRIAL_COUNT + i + 1}.</Text>
              <Ionicons name="lock-closed-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.teaserText} numberOfLines={1}>
                {'••••••••••••••••••••'}
              </Text>
            </View>
          ))}
          {remainingCount > 0 && (
            <Text style={styles.teaserMore}>
              + {remainingCount} more dilemmas...
            </Text>
          )}
        </View>
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
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xl,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.lg,
  },
  backButton: {
    backgroundColor: COLORS.magenta,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  backButtonText: {
    color: COLORS.text,
    fontWeight: FONTS.weights.bold,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  badgeContainer: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  diamondFrame: {
    width: 90,
    height: 90,
    borderWidth: 2,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    backgroundColor: COLORS.surface,
  },
  badgeEmoji: {
    fontSize: 36,
    transform: [{ rotate: '-45deg' }],
  },
  premiumLabel: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.premiumBg,
  },
  premiumLabelText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  headlineBlock: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headline: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  subheadline: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  categoryNameInline: {
    fontWeight: FONTS.weights.bold,
  },
  lossAversion: {
    color: COLORS.premium,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  benefitsTitle: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  benefitIconStyle: {
    width: 28,
    textAlign: 'center',
  },
  benefitText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    flex: 1,
    lineHeight: 22,
  },
  priceBlock: {
    alignItems: 'center',
    gap: 4,
  },
  price: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.extrabold,
  },
  priceNote: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  unlockBtn: {
    width: '100%',
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
    }),
  },
  unlockBtnText: {
    color: COLORS.textOnColor,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  restoreBtn: {
    paddingVertical: SPACING.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  restoreBtnText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textDecorationLine: 'underline',
  },
  teaserSection: {
    width: '100%',
    gap: SPACING.sm,
  },
  teaserLabel: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.extrabold,
    letterSpacing: 2,
  },
  teaserSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  teaserList: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  teaserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    opacity: 0.5,
  },
  teaserNum: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    minWidth: 20,
  },
  teaserText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    letterSpacing: 4,
    flex: 1,
  },
  teaserMore: {
    color: COLORS.premium,
    fontSize: FONTS.sizes.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
