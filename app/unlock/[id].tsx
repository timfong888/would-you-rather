import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getCategoryById, getCategoryQuestions, FREE_TRIAL_COUNT } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import analytics from '@/utils/analytics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type PaymentState = 'idle' | 'sheet' | 'processing' | 'success';

const PAYMENT_MS = 1800;
const RESTORE_MS = 1400;

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
  const { isUnlocked, unlock } = useUnlocked();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [useApplePay, setUseApplePay] = useState(true);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(400)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const category = getCategoryById(id as CategoryId);
  const questions = getCategoryQuestions(id as CategoryId);

  useEffect(() => {
    if (paymentState === 'processing') {
      spinLoopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoopRef.current.start();
    } else {
      spinLoopRef.current?.stop();
      spinAnim.setValue(0);
    }
    return () => {
      spinLoopRef.current?.stop();
      spinLoopRef.current = null;
    };
  }, [paymentState, spinAnim]);

  useEffect(() => {
    if (paymentState === 'success') {
      checkAnim.setValue(0);
      Animated.spring(checkAnim, {
        toValue: 1,
        tension: 80,
        friction: 6,
        useNativeDriver: true,
      }).start();
    }
  }, [paymentState, checkAnim]);

  useEffect(() => {
    if (paymentState === 'sheet') {
      sheetAnim.setValue(400);
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 70,
        friction: 11,
        useNativeDriver: true,
      }).start();
    }
  }, [paymentState, sheetAnim]);

  useEffect(() => {
    analytics.track('paywall_viewed', { category_id: id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handlePay = async () => {
    if (paymentState !== 'sheet') return;
    analytics.track('paywall_cta_clicked', {
      category_id: id,
      payment_method: useApplePay ? 'apple_pay' : 'card',
    });
    setPaymentState('processing');
    await new Promise<void>((r) => setTimeout(r, PAYMENT_MS));
    unlock(id as CategoryId);
    setPaymentState('success');
  };

  const handleRestorePurchases = async () => {
    setRestoreMsg(null);
    setPaymentState('processing');
    await new Promise<void>((r) => setTimeout(r, RESTORE_MS));
    if (isUnlocked(id as CategoryId)) {
      setPaymentState('success');
    } else {
      setRestoreMsg('No previous purchases found for this account.');
      setPaymentState('idle');
    }
  };

  const handleStartPlaying = () => {
    const firstPremiumQ = questions[FREE_TRIAL_COUNT];
    if (firstPremiumQ) {
      router.replace(`/game/${firstPremiumQ.id}?cat=${id}&idx=${FREE_TRIAL_COUNT}`);
    } else {
      router.replace(`/categories/${id as string}`);
    }
  };

  const spinRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Main Scroll Content ── */}
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
        scrollEnabled={paymentState === 'idle'}
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
          onPress={() => { setRestoreMsg(null); setPaymentState('sheet'); }}
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

        {restoreMsg !== null && (
          <Text style={styles.restoreMsg}>{restoreMsg}</Text>
        )}

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

      {/* ── Payment Sheet ── */}
      {paymentState === 'sheet' && (
        <View style={styles.overlayWrap} accessibilityViewIsModal>
          {/* Backdrop — tapping closes the sheet */}
          <Pressable
            style={styles.backdrop}
            onPress={() => setPaymentState('idle')}
            accessibilityRole="button"
            accessibilityLabel="Close payment sheet"
          />

          {/* Sheet slides up from bottom */}
          <Animated.View
            style={[
              styles.paymentSheet,
              { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.lg },
              { transform: [{ translateY: sheetAnim }] },
            ]}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Complete Your Purchase</Text>

            {/* Product summary row */}
            <View style={[styles.productCard, { borderColor: `${category.color}30` }]}>
              <View style={[styles.productIconBg, { backgroundColor: `${category.color}18` }]}>
                <Text style={styles.productIcon}>{category.emoji}</Text>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{category.label}</Text>
                <Text style={styles.productDesc}>
                  Premium Pack · {questions.length} dilemmas
                </Text>
              </View>
              <Text style={[styles.productPrice, { color: category.color }]}>$2.99</Text>
            </View>

            {/* Payment method selector */}
            <View style={styles.methodRow}>
              <Pressable
                onPress={() => setUseApplePay(true)}
                style={[
                  styles.methodBtn,
                  useApplePay && {
                    borderColor: category.color,
                    backgroundColor: `${category.color}0D`,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: useApplePay }}
                accessibilityLabel="Pay with Apple Pay"
              >
                <Ionicons name="logo-apple" size={17} color={colors.text} />
                <Text style={[styles.methodLabel, { color: colors.text }]}>Apple Pay</Text>
                {useApplePay && (
                  <Ionicons name="checkmark-circle" size={16} color={category.color} />
                )}
              </Pressable>

              <Pressable
                onPress={() => setUseApplePay(false)}
                style={[
                  styles.methodBtn,
                  !useApplePay && {
                    borderColor: category.color,
                    backgroundColor: `${category.color}0D`,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: !useApplePay }}
                accessibilityLabel="Pay with card"
              >
                <Ionicons name="card-outline" size={17} color={colors.text} />
                <Text style={[styles.methodLabel, { color: colors.text }]}>Card</Text>
                {!useApplePay && (
                  <Ionicons name="checkmark-circle" size={16} color={category.color} />
                )}
              </Pressable>
            </View>

            {/* Pay CTA */}
            {useApplePay ? (
              <Pressable
                onPress={handlePay}
                style={({ pressed }) => [
                  styles.applePayBtn,
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pay $2.99 with Apple Pay"
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.applePayBtnText}>Pay  $2.99</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handlePay}
                style={({ pressed }) => [
                  styles.payBtn,
                  { backgroundColor: category.color },
                  pressed && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pay $2.99 with card"
              >
                <Text style={styles.payBtnText}>PAY $2.99</Text>
              </Pressable>
            )}

            <Text style={styles.legalText}>
              By completing this purchase you agree to our Terms of Service.
              {'\n'}Payments are processed securely. Non-refundable.
            </Text>

            <Pressable
              onPress={() => setPaymentState('idle')}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* ── Processing Overlay ── */}
      {paymentState === 'processing' && (
        <View style={[styles.fullOverlay, { backgroundColor: colors.background }]}>
          <View style={[styles.processingIconBg, { backgroundColor: `${category.color}15` }]}>
            <Text style={styles.processingEmoji}>{category.emoji}</Text>
          </View>

          <Animated.View
            style={[
              styles.spinner,
              { borderColor: colors.border, borderTopColor: category.color },
              { transform: [{ rotate: spinRotate }] },
            ]}
          />

          <Text style={[styles.processingTitle, { color: colors.text }]}>Authorizing…</Text>
          <Text style={[styles.processingSubtitle, { color: colors.textSecondary }]}>
            Securely processing your payment
          </Text>
        </View>
      )}

      {/* ── Success Overlay ── */}
      {paymentState === 'success' && (
        <View
          style={[
            styles.fullOverlay,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + SPACING.xl,
              paddingBottom: insets.bottom + SPACING.xl,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.checkCircle,
              {
                borderColor: `${colors.success}50`,
                backgroundColor: `${colors.success}15`,
              },
              { transform: [{ scale: checkAnim }] },
            ]}
          >
            <Ionicons name="checkmark" size={52} color={colors.success} />
          </Animated.View>

          <View style={styles.successTextBlock}>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Category Unlocked!
            </Text>
            <Text style={[styles.successCategory, { color: category.color }]}>
              {category.emoji}  {category.label}
            </Text>
            <Text style={[styles.successBody, { color: colors.textSecondary }]}>
              All {questions.length} dilemmas are now yours to explore.
            </Text>
          </View>

          <Pressable
            onPress={handleStartPlaying}
            style={({ pressed }) => [
              styles.startPlayingBtn,
              { backgroundColor: category.color },
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start playing the unlocked category"
          >
            <Text style={styles.startPlayingBtnText}>START PLAYING →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
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
    restoreMsg: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
      fontStyle: 'italic',
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

    // ── Payment sheet overlay ──────────────────────────────────────
    overlayWrap: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    paymentSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      gap: SPACING.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 12,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: RADIUS.full,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: SPACING.xs,
    },
    sheetTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.extrabold,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.background,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
    },
    productIconBg: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    productIcon: {
      fontSize: 26,
    },
    productInfo: {
      flex: 1,
      gap: 2,
    },
    productName: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    productDesc: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      letterSpacing: 0.3,
    },
    productPrice: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.extrabold,
      flexShrink: 0,
    },
    methodRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    methodBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.sm,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    methodLabel: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      flex: 1,
    },
    applePayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      backgroundColor: '#000000',
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
      }),
    },
    applePayBtnText: {
      color: '#FFFFFF',
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 0.5,
    },
    payBtn: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
      }),
    },
    payBtnText: {
      color: '#FFFFFF',
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    legalText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      textAlign: 'center',
      lineHeight: 18,
    },
    cancelBtn: {
      alignSelf: 'center',
      paddingVertical: SPACING.sm,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
    },

    // ── Processing overlay ────────────────────────────────────────
    fullOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.lg,
      paddingHorizontal: SPACING.xl,
    },
    processingIconBg: {
      width: 80,
      height: 80,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    processingEmoji: {
      fontSize: 38,
    },
    spinner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 3,
    },
    processingTitle: {
      fontSize: FONTS.sizes.xl,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    processingSubtitle: {
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
    },

    // ── Success overlay ───────────────────────────────────────────
    checkCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTextBlock: {
      alignItems: 'center',
      gap: SPACING.sm,
    },
    successTitle: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.extrabold,
      textAlign: 'center',
      letterSpacing: 1,
    },
    successCategory: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.bold,
      textAlign: 'center',
    },
    successBody: {
      fontSize: FONTS.sizes.md,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 280,
    },
    startPlayingBtn: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      alignItems: 'center',
      marginTop: SPACING.sm,
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'opacity 0.15s ease' },
      }),
    },
    startPlayingBtnText: {
      color: '#FFFFFF',
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
  });
}
