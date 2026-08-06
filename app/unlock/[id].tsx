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
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IoniconsName; text: string }[] = [
  { icon: 'chatbubbles-outline', text: 'Spark 20 conversations you won\'t see coming' },
  { icon: 'people-outline', text: 'Discover what the world chooses — then debate why' },
  { icon: 'infinite-outline', text: 'Beat boredom anywhere: road trips, dinners, downtime' },
  { icon: 'heart-outline', text: 'Nothing interrupts the moment — completely ad-free' },
];

export default function UnlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles(makeStyles);

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
        <Ionicons name="close" size={20} color={colors.textSecondary} />
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
        <Text style={styles.headline}>KEEP THE CONVERSATION GOING</Text>
        <Text style={styles.subheadline}>
          You've had a taste of{' '}
          <Text style={[styles.categoryNameInline, { color: category.color }]}>
            "{category.label}"
          </Text>
          {' '}— the questions that make people lean in, laugh, and reveal what they really think.
        </Text>
        <Text style={styles.lossAversion}>
          {questions.length - FREE_TRIAL_COUNT} more conversations waiting. Don't leave them on the table.
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
              color={colors.textSecondary}
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
        <Text style={styles.unlockBtnText}>START {questions.length - FREE_TRIAL_COUNT} MORE CONVERSATIONS →</Text>
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

      {/* Social comparison hook */}
      <View style={styles.socialCard}>
        <Text style={styles.socialCardTitle}>BUILD REAL CONNECTIONS</Text>
        <Text style={styles.socialCardBody}>
          Share a question with family or friends and watch opinions fly.
          Parents: this is the easiest way to get kids talking — no screens
          required, just real back-and-forth that builds lasting closeness.
        </Text>
        <View style={styles.socialSteps}>
          <View style={styles.socialStep}>
            <Text style={styles.socialStepNum}>1</Text>
            <Text style={styles.socialStepText}>You answer — share the question to challenge them</Text>
          </View>
          <View style={styles.socialStep}>
            <Text style={styles.socialStepNum}>2</Text>
            <Text style={styles.socialStepText}>They reveal their choice and the debate begins</Text>
          </View>
          <View style={styles.socialStep}>
            <Text style={styles.socialStepNum}>3</Text>
            <Text style={styles.socialStepText}>20 rounds of the kind of talk that actually matters</Text>
          </View>
        </View>
      </View>

      {/* Research-backed callout */}
      <View style={styles.researchCard}>
        <Text style={styles.researchCardTitle}>WHY IT WORKS</Text>
        <Text style={styles.researchCardBody}>
          Research from Harvard's Center on the Developing Child shows that
          back-and-forth conversations between parents and children build stronger
          brain connections and emotional resilience. The Search Institute lists
          "daily meaningful conversations" as one of the 40 key assets for
          healthy adolescent development. Every Would You Rather question is a
          conversation waiting to happen.
        </Text>
      </View>

      {/* Category preview teaser */}
      <View style={styles.teaserSection}>
        <Text style={styles.teaserLabel}>WHAT AWAITS</Text>
        <Text style={styles.teaserSubtitle}>A glimpse of what remains locked:</Text>
        <View style={styles.teaserList}>
          {teaserQuestions.map((q, i) => (
            <View key={q.id} style={styles.teaserItem}>
              <Text style={styles.teaserNum}>{FREE_TRIAL_COUNT + i + 1}.</Text>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: colors.background,
      padding: SPACING.lg,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.lg,
    },
    backButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    backButtonText: {
      color: colors.textOnColor,
      fontWeight: FONTS.weights.bold,
    },
    closeBtn: {
      alignSelf: 'flex-end',
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surfaceLight,
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
      backgroundColor: colors.surface,
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
      backgroundColor: colors.premiumBg,
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
      color: colors.text,
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
      textAlign: 'center',
    },
    subheadline: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 320,
    },
    categoryNameInline: {
      fontWeight: FONTS.weights.bold,
    },
    lossAversion: {
      color: colors.premium,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    benefitsCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benefitsTitle: {
      color: colors.textMuted,
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
      color: colors.text,
      fontSize: FONTS.sizes.md,
      flex: 1,
      lineHeight: 22,
    },
    priceBlock: {
      alignItems: 'center',
      gap: 4,
    },
    price: {
      color: colors.text,
      fontSize: FONTS.sizes.xxxl,
      fontWeight: FONTS.weights.extrabold,
    },
    priceNote: {
      color: colors.textMuted,
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
      color: colors.textOnColor,
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
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textDecorationLine: 'underline',
    },
    socialCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    socialCardTitle: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    socialCardBody: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      lineHeight: 20,
    },
    socialSteps: {
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    socialStep: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    socialStepNum: {
      width: 24,
      height: 24,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      color: colors.textOnColor,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      textAlign: 'center',
      lineHeight: 24,
      flexShrink: 0,
      overflow: 'hidden',
    },
    socialStepText: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      lineHeight: 20,
      paddingTop: 2,
    },
    researchCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    researchCardTitle: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    researchCardBody: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      lineHeight: 20,
    },
    teaserSection: {
      width: '100%',
      gap: SPACING.sm,
    },
    teaserLabel: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    teaserSubtitle: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
    },
    teaserList: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    teaserItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      opacity: 0.5,
    },
    teaserNum: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      minWidth: 20,
    },
    teaserText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      letterSpacing: 4,
      flex: 1,
    },
    teaserMore: {
      color: colors.premium,
      fontSize: FONTS.sizes.sm,
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
  });
}
