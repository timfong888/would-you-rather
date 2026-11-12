import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { CATEGORIES, hasPaidContent } from '@/constants/questions';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { track } from '@/lib/analytics';


export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    isUnlocked,
    reset: resetUnlocked,
    ownerAccess,
    revokeOwnerAccess,
  } = useUnlocked();
  const { reset: resetAnswered } = useAnsweredQuestions();
  const { styles, colors } = useThemedStyles(makeStyles);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Owner access is redeemed on the payment sheet ("Have a code?" on the
  // unlock screen). Settings only shows status and lets the owner revoke it.
  const handleRevokeOwnerAccess = () => {
    revokeOwnerAccess();
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

      {/* Owner access — status + revoke only; redeemed via "Have a code?" on the paywall */}
      {ownerAccess && (
        <>
          <Text style={styles.sectionHeader}>OWNER ACCESS</Text>
          <View style={styles.section}>
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

      <Text style={styles.version}>VERSION {appVersion}</Text>
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
