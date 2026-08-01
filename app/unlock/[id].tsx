import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import { COPY } from '@/constants/copy';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useTheme } from '@/contexts/ThemeContext';

const BENEFITS = [
  { icon: '💬', text: '20 exclusive hand-picked dilemmas' },
  { icon: '📊', text: 'Global real-time voter statistics' },
  { icon: '♾️', text: 'Permanent library access — own it forever' },
  { icon: '🚫', text: 'Ad-free category experience' },
];

export default function UnlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { unlock } = useUnlocked();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const category = getCategoryById(id as CategoryId);
  const questions = getCategoryQuestions(id as CategoryId);

  if (!category) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Category not found</Text>
        <Pressable onPress={() => router.push('/categories')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Browse Categories</Text>
        </Pressable>
      </View>
    );
  }

  const handleUnlock = () => {
    unlock(id as CategoryId);
    const firstLockedQ = questions[FREE_TRIAL_COUNT];
    if (firstLockedQ) {
      router.replace(`/game/${firstLockedQ.id}?cat=${id}&idx=${FREE_TRIAL_COUNT}`);
    } else {
      router.back();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Close Button */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.closeBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
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
          {questions.length - 3} dilemmas remain locked. Will you leave them unanswered?
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>WHAT YOU GET</Text>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <Text style={styles.benefitIcon}>{b.icon}</Text>
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
      >
        <Text style={styles.unlockBtnText}>UNLOCK {COPY.dilemmaCount(questions.length)} →</Text>
      </Pressable>

      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [
          styles.restoreBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Text style={styles.restoreBtnText}>Restore Purchases</Text>
      </Pressable>

      {/* Category preview teaser */}
      <View style={styles.teaserSection}>
        <Text style={styles.teaserLabel}>WHAT AWAITS</Text>
        <Text style={styles.teaserSubtitle}>A glimpse of what remains locked:</Text>
        <View style={styles.teaserList}>
          {questions.slice(3, 6).map((q, i) => (
            <View key={q.id} style={styles.teaserItem}>
              <Text style={styles.teaserNum}>{i + 4}.</Text>
              <Text style={styles.teaserText} numberOfLines={1}>
                {'••••••••••••••••••••'}
              </Text>
            </View>
          ))}
          <Text style={styles.teaserMore}>
            + {questions.length - 6} more dilemmas...
          </Text>
        </View>
      </View>

      <View style={{ height: SPACING.xl }} />
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
      padding: SPACING.lg,
      gap: SPACING.xl,
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      backgroundColor: colors.background,
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
    closeBtnText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
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
    benefitIcon: {
      fontSize: 20,
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
