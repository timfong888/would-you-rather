import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { CATEGORIES, hasPaidContent } from '@/constants/questions';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { track } from '@/lib/analytics';

// Tap the version label this many times to reveal the owner-access panel.
const OWNER_TAPS_TO_REVEAL = 7;

export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    isUnlocked,
    reset: resetUnlocked,
    ownerAccess,
    ownerAccessAvailable,
    grantOwnerAccess,
    revokeOwnerAccess,
  } = useUnlocked();
  const { reset: resetAnswered } = useAnsweredQuestions();
  const { styles, colors } = useThemedStyles(makeStyles);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // ── Owner access (hidden until the version label is tapped 7×) ──
  const [versionTaps, setVersionTaps] = useState(0);
  const [ownerPanelOpen, setOwnerPanelOpen] = useState(false);
  const [ownerCode, setOwnerCode] = useState('');
  const [ownerCodeState, setOwnerCodeState] = useState<'idle' | 'checking' | 'invalid'>('idle');

  const handleVersionTap = () => {
    if (ownerPanelOpen || ownerAccess) return;
    const next = versionTaps + 1;
    if (next >= OWNER_TAPS_TO_REVEAL) {
      setVersionTaps(0);
      setOwnerPanelOpen(true);
    } else {
      setVersionTaps(next);
    }
  };

  const handleRedeemOwnerCode = async () => {
    if (!ownerCode.trim() || ownerCodeState === 'checking') return;
    setOwnerCodeState('checking');
    const ok = await grantOwnerAccess(ownerCode);
    if (ok) {
      setOwnerCode('');
      setOwnerCodeState('idle');
      setOwnerPanelOpen(false);
      track('owner_access_granted');
    } else {
      setOwnerCodeState('invalid');
    }
  };

  const handleRevokeOwnerAccess = () => {
    revokeOwnerAccess();
    setOwnerPanelOpen(false);
    track('owner_access_revoked');
  };

  // Packs with paid content (premium categories + free categories with an
  // expansion pack) that this device can fully play.
  const unlockedPacks = CATEGORIES.filter(
    (cat) => hasPaidContent(cat) && isUnlocked(cat.id)
  );

  const handleResetProgress = () => {
    const doReset = () => {
      resetAnswered();
      resetUnlocked();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (
        window.confirm(
          'Reset all progress? This will clear your answered questions and unlocked packs.'
        )
      ) {
        doReset();
      }
    } else {
      Alert.alert(
        'Reset Progress',
        'This will clear your answered questions and unlocked packs.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: doReset },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* App Experience */}
      <Text style={styles.sectionHeader}>APP EXPERIENCE</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.magenta }}
            thumbColor={colors.textOnColor}
          />
        </View>
      </View>

      {/* Progress */}
      <Text style={styles.sectionHeader}>PROGRESS</Text>
      <View style={styles.section}>
        <Pressable
          onPress={handleResetProgress}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={[styles.rowLabel, { color: colors.secondary }]}>
            Reset Progress
          </Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      {/* Owner access — only rendered once revealed or active */}
      {(ownerAccess || ownerPanelOpen) && (
        <>
          <Text style={styles.sectionHeader}>OWNER ACCESS</Text>
          <View style={styles.section}>
            {ownerAccess ? (
              <View style={styles.ownerBlock}>
                <View style={styles.ownerBanner}>
                  <Text style={styles.ownerBannerIcon}>🔑</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ownerBannerTitle}>Owner access active</Text>
                    <Text style={styles.ownerBannerBody}>
                      Every pack and expansion is unlocked on this device. Analytics events
                      from this device are tagged so they stay out of paywall metrics.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={handleRevokeOwnerAccess}
                  style={({ pressed }) => [styles.ownerSecondaryBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ownerSecondaryBtnText}>Revoke owner access</Text>
                </Pressable>
              </View>
            ) : ownerAccessAvailable ? (
              <View style={styles.ownerBlock}>
                <Text style={styles.ownerHelp}>
                  Enter the owner access code to unlock every pack without going through
                  the payment flow.
                </Text>
                <TextInput
                  value={ownerCode}
                  onChangeText={(t) => { setOwnerCode(t); if (ownerCodeState === 'invalid') setOwnerCodeState('idle'); }}
                  onSubmitEditing={handleRedeemOwnerCode}
                  placeholder="Access code"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  style={[
                    styles.ownerInput,
                    ownerCodeState === 'invalid' && { borderColor: colors.secondary },
                  ]}
                  accessibilityLabel="Owner access code"
                />
                {ownerCodeState === 'invalid' && (
                  <Text style={styles.ownerError}>That code didn't match. Check for extra spaces and try again.</Text>
                )}
                <Pressable
                  onPress={handleRedeemOwnerCode}
                  disabled={!ownerCode.trim() || ownerCodeState === 'checking'}
                  style={({ pressed }) => [
                    styles.ownerPrimaryBtn,
                    (!ownerCode.trim() || ownerCodeState === 'checking') && { opacity: 0.5 },
                    pressed && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ownerPrimaryBtnText}>
                    {ownerCodeState === 'checking' ? 'CHECKING…' : 'UNLOCK EVERYTHING'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setOwnerPanelOpen(false); setOwnerCode(''); setOwnerCodeState('idle'); }}
                  style={({ pressed }) => [styles.ownerSecondaryBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ownerSecondaryBtnText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.ownerBlock}>
                <Text style={styles.ownerHelp}>
                  Owner access isn't configured for this build. Set
                  EXPO_PUBLIC_OWNER_ACCESS_SHA256 and redeploy — see docs/owner-access.md.
                </Text>
                <Pressable
                  onPress={() => setOwnerPanelOpen(false)}
                  style={({ pressed }) => [styles.ownerSecondaryBtn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ownerSecondaryBtnText}>Close</Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      {/* Unlocked Packs */}
      <Text style={styles.sectionHeader}>UNLOCKED PACKS</Text>
      <View style={styles.section}>
        {unlockedPacks.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.emptyText}>No packs unlocked yet</Text>
          </View>
        ) : (
          unlockedPacks.map((cat, index) => (
            <React.Fragment key={cat.id}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <Text style={styles.rowIcon}>{cat.emoji}</Text>
                <Text style={styles.rowLabel}>{cat.label}</Text>
                <View
                  style={[
                    styles.badge,
                    { borderColor: cat.color, backgroundColor: `${cat.color}20` },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: cat.color }]}>
                    UNLOCKED
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      {/* Legal */}
      <Text style={styles.sectionHeader}>LEGAL</Text>
      <View style={styles.section}>
        <Pressable
          onPress={() => router.push('/privacy')}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          onPress={() => router.push('/terms')}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.rowLabel}>Terms of Service</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleVersionTap} hitSlop={12} accessibilityLabel={`Version ${appVersion}`}>
        <Text style={styles.version}>
          VERSION {appVersion}
          {versionTaps >= 3 && versionTaps < OWNER_TAPS_TO_REVEAL
            ? `  ·  ${OWNER_TAPS_TO_REVEAL - versionTaps} more`
            : ''}
        </Text>
      </Pressable>
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
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xxl,
    },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 2,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xs,
    },
    section: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      gap: SPACING.sm,
      ...Platform.select({
        web: { cursor: 'auto' },
      }),
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.sizes.md,
    },
    rowIcon: {
      fontSize: 20,
      width: 28,
    },
    rowChevron: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xl,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: SPACING.lg,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      fontStyle: 'italic',
    },
    badge: {
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 0.5,
    },
    ownerBlock: {
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    ownerBanner: {
      flexDirection: 'row',
      gap: SPACING.sm,
      alignItems: 'flex-start',
      backgroundColor: colors.premiumBg,
      borderColor: colors.premium,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
    },
    ownerBannerIcon: {
      fontSize: 20,
    },
    ownerBannerTitle: {
      color: colors.premium,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 0.5,
    },
    ownerBannerBody: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.xs,
      marginTop: 2,
    },
    ownerHelp: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
    },
    ownerInput: {
      color: colors.text,
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: FONTS.sizes.md,
    },
    ownerError: {
      color: colors.secondary,
      fontSize: FONTS.sizes.xs,
    },
    ownerPrimaryBtn: {
      backgroundColor: colors.premium,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    ownerPrimaryBtnText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    ownerSecondaryBtn: {
      alignItems: 'center',
      paddingVertical: SPACING.xs,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    ownerSecondaryBtnText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
    },
    version: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      letterSpacing: 1.5,
      paddingVertical: SPACING.xl,
    },
  });
}
