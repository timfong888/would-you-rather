import React, { useState, useEffect, useRef } from 'react';
import { COPY } from '@/constants/copy';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Easing,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, useRootNavigationState } from 'expo-router';
import { browseHrefFor } from '@/lib/browse';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import {
  getCategoryById,
  getCategoryQuestions,
  getFreeQuestionCount,
  getLockedQuestionCount,
  getNextTranche,
  hasLockedRemaining,
  isQuestionLocked,
  isTrancheSellable,
  offersAllCategoriesPack,
  trancheSize,
} from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { useUnlocked, WEB_FREE_UNLOCK } from '@/contexts/UnlockedContext';
import { offeredTrancheOpen, paywallEntry, paywallLateUnlock, restoreOpensTranche } from '@/lib/access';
import { replaceWhenReady } from '@/lib/navigateWhenReady';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { track as trackEvent } from '@/lib/analytics';
import { requiresParentalGate } from '@/lib/parentalGate';
import { ParentalGate } from '@/components/ParentalGate';
import {
  PRODUCT_ALL,
  productForCategory,
} from '@/lib/catalog';
import { purchases } from '@/lib/purchases';
import { purchaseErrorMessage, isPurchasePending } from '@/lib/purchaseErrors';
import { reportError } from '@/lib/errorTracking';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// @expo/vector-icons 15 ships an Ionicons font with taller line metrics: a 20px icon lays out 23px
// high on web instead of 22px (14.x), which shifts the paywall by a few pixels. Pin the old height.
const ICON_20_WEB = Platform.OS === 'web' ? { lineHeight: 22 } : null;
type PaymentState = 'idle' | 'processing' | 'success';

// Temporary production web free unlock (Tim, 2026-11-21, "128 b"), until web
// payments exist: EXPO_PUBLIC_WEB_FREE_UNLOCK=1 on Vercel. No fake checkout:
// the CTA unlocks directly and the paywall says it is free. It takes priority
// over a web RevenueCat key (production refuses both together, see
// scripts/check-web-build.mjs). Its copy carries the marker "FREE FOR NOW",
// which the production bundle scan rejects when the flag is off.
const WEB_FREE_UI = Platform.OS === 'web' && process.env.EXPO_PUBLIC_WEB_FREE_UNLOCK === '1' && WEB_FREE_UNLOCK;

function benefitsFor(lockedCount: number): { icon: IoniconsName; text: string }[] {
  return [
    { icon: 'chatbubbles-outline', text: `Spark ${lockedCount} conversations you won't see coming` },
    { icon: 'people-outline', text: 'Discover what the world chooses — then debate why' },
    { icon: 'infinite-outline', text: 'Beat boredom anywhere: road trips, dinners, downtime' },
    { icon: 'heart-outline', text: 'Nothing interrupts the moment — completely ad-free' },
  ];
}

export default function UnlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Purchases reachable from kids/family content sit behind a parental gate, and
  // nothing on that path is tracked (Tim, 2026-11-18).
  const kidsDirected = requiresParentalGate(String(id));
  const [gatePassed, setGatePassed] = useState(false);
  const track: typeof trackEvent = (...args) => {
    if (!kidsDirected) trackEvent(...args);
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles(makeStyles);
  const {
    isUnlocked,
    openTranches,
    unlock,
    unlockAll,
    ownerAccessAvailable,
    grantOwnerAccess,
    purchasesAvailable,
    entitlementsLoaded,
    applyEntitlements,
    priceForCategory,
    priceForAll,
  } = useUnlocked();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  // Real purchases: RevenueCat on iOS (App Store) and web (Web Billing / Stripe).
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // "Have a code?" on the payment sheet. Redeeming the owner code grants
  // owner access (every pack), which also completes this unlock.
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'invalid'>('idle');

  const handleRedeemCode = async () => {
    if (!code.trim() || codeState === 'checking') return;
    setCodeState('checking');
    let ok = false;
    try {
      ok = await grantOwnerAccess(code);
    } catch {
      // Never leave the input stuck on "Checking…" if verification throws.
      ok = false;
    }
    if (!ok) {
      setCodeState('invalid');
      return;
    }
    track('owner_access_granted', { surface: 'paywall', category_id: id });
    setCode('');
    setCodeState('idle');
    setCodeOpen(false);
    purchasedStartRef.current = trancheStart;
    purchasedSizeRef.current = remainingLocked;
    purchasedAllRef.current = true;
    setPaymentState('success');
  };

  const spinAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const category = getCategoryById(id as CategoryId);
  const questions = getCategoryQuestions(id as CategoryId);
  const freeCount = category ? getFreeQuestionCount(category) : 0;
  const lockedCount = category ? getLockedQuestionCount(category) : 0;
  // Every category sells its next unowned tranche (#238): the next 15 or 20 questions.
  const access = category ? openTranches(category) : false;
  const nextTranche = category ? getNextTranche(category, access) : undefined;
  const nextSize = nextTranche ? trancheSize(nextTranche) : lockedCount;
  // What the all-categories unlock opens in this category: everything still locked for this player.
  const remainingLocked = category ? questions.filter((_, i) => isQuestionLocked(category, i, access)).length : 0;
  const trancheStart = nextTranche ? nextTranche.first - 1 : freeCount;
  // Tranche 2 and every kids or teen tranche have no store product until step F5; the web free unlock is for grown-ups only.
  const sellable = nextTranche === undefined || (!!category && isTrancheSellable(category));
  const nothingToSell = category ? !hasLockedRemaining(category, access) : isUnlocked(id as CategoryId);
  const purchasedStartRef = useRef(trancheStart);
  const purchasedSizeRef = useRef(nextSize);
  // The all-categories unlock and owner access open everything: the success screen says so.
  const purchasedAllRef = useRef(false);
  // The tranche this paywall offered when it was first shown: a late entitlement for it ends the paywall.
  const offeredKRef = useRef<number | undefined>(undefined);
  const BENEFITS = benefitsFor(nextSize);

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

  // Once, after the first entitlement fetch settles: someone who already has
  // this category (purchased or owner access) landing here by URL or reload is
  // sent to the category instead of being offered what they own, and is not a
  // paywall view (counting it would deflate conversion).
  const entryCheckedRef = useRef(false);
  const cancelEntryNavRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelEntryNavRef.current?.(), []);
  // Navigating before the root navigator mounts (cold deep link) throws.
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (entryCheckedRef.current) return;
    const entry = paywallEntry({ entitlementsLoaded, navReady, unlocked: nothingToSell });
    if (entry === 'wait') return;
    entryCheckedRef.current = true;
    if (entry === 'to-category') {
      cancelEntryNavRef.current = replaceWhenReady(router, `/categories/${id as string}`);
      return;
    }
    offeredKRef.current = nextTranche?.k ?? 1;
    track('paywall_viewed', { category_id: id, pack_type: 'tranche', tranche: nextTranche?.k });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitlementsLoaded, navReady]);

  // Entitlements that arrive after the entry decision (Sinatra P2 on PR #128):
  // a buyer whose first fetch outlived the load timeout is sent on once their
  // category unlocks, as long as the paywall is idle.
  const unlockedNow = nothingToSell || offeredTrancheOpen(access, offeredKRef.current);
  useEffect(() => {
    if (
      !paywallLateUnlock({
        entryChecked: entryCheckedRef.current,
        navReady,
        unlocked: unlockedNow,
        idle: paymentState === 'idle',
        redeemingCode: codeState === 'checking',
      }) ||
      cancelEntryNavRef.current
    ) return;
    cancelEntryNavRef.current = replaceWhenReady(router, `/categories/${id as string}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedNow, paymentState, codeState, navReady]);

  if (kidsDirected && !gatePassed) {
    return <ParentalGate onPass={() => setGatePassed(true)} onCancel={() => router.back()} />;
  }

  if (!category) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top + SPACING.lg }]}>
        <Text style={styles.errorText}>Category not found</Text>
        <Pressable onPress={() => router.push(browseHrefFor(id))} style={styles.backButton}>
          <Text style={styles.backButtonText}>Browse Categories</Text>
        </Pressable>
      </View>
    );
  }

  const teaserQuestions = questions.slice(trancheStart, trancheStart + 3);
  const remainingCount = Math.max(nextSize - teaserQuestions.length, 0);

  const productId = productForCategory(id as string);
  // Store price when loaded, else the approved price ($1.99 category, $4.99 pack).
  const shownPrice = priceForCategory(id as string);
  const allPrice = priceForAll();

  // Temporary web free unlock: no checkout, no charge.
  const handleFreeUnlock = (kind: 'category' | 'all') => {
    if (!WEB_FREE_UI || paymentState !== 'idle') return;
    purchasedStartRef.current = trancheStart;
    purchasedSizeRef.current = kind === 'all' ? remainingLocked : nextSize;
    purchasedAllRef.current = kind === 'all';
    setPurchaseError(null);
    setRestoreMsg(null);
    track('paywall_cta_clicked', {
      category_id: id,
      pack_type: kind === 'all' ? 'all' : 'tranche',
      tranche: nextTranche?.k,
      payment_method: 'free_unlock',
    });
    if (kind === 'all') unlockAll();
    else unlock(id as CategoryId);
    setPaymentState('success');
  };

  const handleBuy = async (kind: 'category' | 'all') => {
    if (paymentState !== 'idle') return;
    purchasedStartRef.current = trancheStart;
    purchasedSizeRef.current = kind === 'all' ? remainingLocked : nextSize;
    purchasedAllRef.current = kind === 'all';
    setPurchaseError(null);
    setRestoreMsg(null);
    track('paywall_cta_clicked', {
      category_id: id,
      pack_type: kind === 'all' ? 'all' : 'tranche',
      tranche: nextTranche?.k,
      payment_method: 'store',
    });
    setPaymentState('processing');
    try {
      const result = await purchases.purchase(kind === 'all' ? PRODUCT_ALL : productId);
      if (result.status === 'cancelled') {
        // User backed out of the Apple sheet: not an error.
        setPaymentState('idle');
        return;
      }
      applyEntitlements(result.entitlements);
      track('purchase_completed', { category_id: id, product: kind });
      setPaymentState('success');
    } catch (e) {
      // Ask to Buy / deferred payment is not a failure: no failure event, no error report.
      if (isPurchasePending(e)) {
        track('purchase_pending', { category_id: id, product: kind });
      } else {
        track('purchase_failed', { category_id: id, product: kind });
        // Raw SDK/store errors go to error tracking only, never on screen (#159).
        reportError(e, 'manual');
      }
      setPurchaseError(purchaseErrorMessage(e));
      setPaymentState('idle');
    }
  };

  const handleRestorePurchases = async () => {
    setRestoreMsg(null);
    setPurchaseError(null);
    if (!purchasesAvailable) {
      setRestoreMsg('Purchases are not available right now.');
      return;
    }
    setPaymentState('processing');
    {
      try {
        purchasedStartRef.current = trancheStart;
        purchasedSizeRef.current = nextSize;
        purchasedAllRef.current = false;
        const active = await purchases.restore();
        applyEntitlements(active);
        // Success only when the restore opens the tranche this paywall offers; otherwise the paywall stays.
        if (category && restoreOpensTranche(active, category, nextTranche?.k ?? 1)) {
          setPaymentState('success');
        } else {
          setRestoreMsg(
            active.length > 0
              ? COPY.restoredNotIncluded
              : Platform.OS === 'web'
                ? 'No purchases found in this browser. Web purchases stay with the browser you bought in.'
                : 'No previous purchases found for this account.',
          );
          setPaymentState('idle');
        }
      } catch (e) {
        reportError(e, 'manual');
        setRestoreMsg('Could not restore purchases right now. Check your connection and try again.');
        setPaymentState('idle');
      }
    }
  };

  const handleStartPlaying = () => {
    // The first question the purchase opened (captured when it started; the tranche advances once it lands).
    const startIdx = purchasedStartRef.current;
    const firstLockedQ = questions[startIdx];
    if (firstLockedQ) {
      router.replace(`/game/${firstLockedQ.id}?cat=${id}&idx=${startIdx}`);
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
          <Ionicons name="close" size={20} color={colors.textSecondary} style={ICON_20_WEB} />
        </Pressable>

        {/* Premium Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.diamondFrame, { borderColor: category.color }]}>
            <Text style={styles.badgeEmoji}>👑</Text>
          </View>
          <View style={[styles.premiumLabel, { borderColor: category.color }]}>
            <Text style={[styles.premiumLabelText, { color: category.color }]}>
              MORE DILEMMAS
            </Text>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>KEEP THE CONVERSATION GOING</Text>
          <Text style={styles.subheadline}>
            You've played the free ones in{' '}
            <Text style={[styles.categoryNameInline, { color: category.color }]}>
              "{category.label}"
            </Text>
            {' — and the best debates are the ones you haven\'t had yet.'}
          </Text>
          <Text style={styles.lossAversion}>
            {nextSize} more conversations waiting. Don't leave them on the table.
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
                style={[styles.benefitIconStyle, ICON_20_WEB]}
              />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Price + CTA */}
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{shownPrice}</Text>
          <Text style={styles.priceNote}>
            {WEB_FREE_UI ? 'FREE FOR NOW · NO PAYMENT NEEDED' : 'ONE-TIME UNLOCK · NO SUBSCRIPTION'}
          </Text>
        </View>

        <Pressable
          disabled={!sellable}
          onPress={() => {
            if (WEB_FREE_UI) {
              handleFreeUnlock('category');
            } else if (purchasesAvailable) {
              handleBuy('category');
            } else {
              // No RevenueCat key: never fall back to a free unlock.
              setPurchaseError('Purchases are not available right now. Please try again later.');
            }
          }}
          style={({ pressed }) => [
            styles.unlockBtn,
            { backgroundColor: category.color },
            pressed && styles.btnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={WEB_FREE_UI ? `${COPY.openNext(nextSize)} for free` : `${COPY.openNext(nextSize)} for ${shownPrice}`}
        >
          <Text style={styles.unlockBtnText}>{sellable ? `START ${nextSize} MORE CONVERSATIONS →` : 'MORE AVAILABLE SOON'}</Text>
        </Pressable>

        {offersAllCategoriesPack(category) && (purchasesAvailable || WEB_FREE_UI) && (
          <Pressable
            onPress={() => {
              if (WEB_FREE_UI) {
                handleFreeUnlock('all');
              } else if (purchasesAvailable) {
                handleBuy('all');
              }
            }}
            style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={WEB_FREE_UI ? 'Unlock all categories for free' : `Unlock all categories for ${allPrice}`}
          >
            <Text style={[styles.restoreBtnText, { color: category.color }]}>
              Or unlock every category · {allPrice}{WEB_FREE_UI ? ' · free for now' : ''}
            </Text>
          </Pressable>
        )}

        {purchaseError !== null && <Text style={styles.restoreMsg}>{purchaseError}</Text>}

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

        {/* Access code (owner / gifted). Only offered when a code is configured
            for this build, and collapsed by default so it doesn't pull
            attention from the purchase. */}
        {ownerAccessAvailable && (
          codeOpen ? (
            <View style={styles.codeBlock}>
              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t); if (codeState === 'invalid') setCodeState('idle'); }}
                onSubmitEditing={handleRedeemCode}
                placeholder="Access code"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                style={[
                  styles.codeInput,
                  codeState === 'invalid' && { borderColor: colors.secondary },
                ]}
                accessibilityLabel="Access code"
              />
              {codeState === 'invalid' && (
                <Text style={styles.codeError}>That code didn't match. Check for extra spaces and try again.</Text>
              )}
              <View style={styles.codeActions}>
                <Pressable
                  onPress={() => { setCodeOpen(false); setCode(''); setCodeState('idle'); }}
                  style={({ pressed }) => [styles.codeSecondaryBtn, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.codeSecondaryBtnText}>Never mind</Text>
                </Pressable>
                <Pressable
                  onPress={handleRedeemCode}
                  disabled={!code.trim() || codeState === 'checking'}
                  style={({ pressed }) => [
                    styles.codeApplyBtn,
                    { backgroundColor: category.color },
                    (!code.trim() || codeState === 'checking') && { opacity: 0.5 },
                    pressed && styles.btnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Apply access code"
                >
                  <Text style={styles.codeApplyBtnText}>
                    {codeState === 'checking' ? 'CHECKING…' : 'APPLY CODE'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setCodeOpen(true)}
              style={({ pressed }) => [styles.codeLink, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Have a code?"
            >
              <Text style={styles.codeLinkText}>Have a code?</Text>
            </Pressable>
          )
        )}


        {/* Social comparison hook */}
        <View style={styles.socialCard}>
          <Text style={styles.socialCardTitle}>CHALLENGE YOUR FRIENDS</Text>
          <Text style={styles.socialCardBody}>
            After you vote, share a link. Friends see the question — but not
            your answer or the vote split. They have to play along to find out
            what you chose and where the world stands.
          </Text>
          <View style={styles.socialSteps}>
            <View style={styles.socialStep}>
              <Text style={styles.socialStepNum}>1</Text>
              <Text style={styles.socialStepText}>You vote — your result stays hidden until they play</Text>
            </View>
            <View style={styles.socialStep}>
              <Text style={styles.socialStepNum}>2</Text>
              <Text style={styles.socialStepText}>They tap your link and pick their own answer</Text>
            </View>
            <View style={styles.socialStep}>
              <Text style={styles.socialStepNum}>3</Text>
              <Text style={styles.socialStepText}>Both of you see the vote split — then compare your takes</Text>
            </View>
          </View>
          <Text style={styles.socialCardFooter}>
            {`${COPY.openNext(nextSize)} and you'll both have a full conversation's worth of takes to debate.`}
          </Text>
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
                <Text style={styles.teaserNum}>{trancheStart + i + 1}.</Text>
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
              {COPY.unlockedTitle}
            </Text>
            <Text style={[styles.successCategory, { color: category.color }]}>
              {category.emoji}  {category.label}
            </Text>
            <Text style={[styles.successBody, { color: colors.textSecondary }]}>
              {purchasedAllRef.current ? COPY.everythingUnlocked : COPY.unlockedBody(purchasedSizeRef.current)}
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
    socialCardFooter: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      lineHeight: 20,
      marginTop: SPACING.xs,
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

    codeLink: {
      alignSelf: 'center',
      paddingVertical: SPACING.xs,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    codeLinkText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textDecorationLine: 'underline',
    },
    codeBlock: {
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    codeInput: {
      color: colors.text,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: FONTS.sizes.md,
    },
    codeError: {
      color: colors.secondary,
      fontSize: FONTS.sizes.xs,
    },
    codeActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    codeSecondaryBtn: {
      paddingVertical: SPACING.xs,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    codeSecondaryBtnText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
    },
    codeApplyBtn: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      ...Platform.select({ web: { cursor: 'pointer', transition: 'opacity 0.15s ease' } }),
    },
    codeApplyBtnText: {
      color: '#FFFFFF',
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
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
