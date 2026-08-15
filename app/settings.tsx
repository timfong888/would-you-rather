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
import { CATEGORIES } from '@/constants/questions';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { isUnlocked, reset: resetUnlocked } = useUnlocked();
  const { reset: resetAnswered } = useAnsweredQuestions();
  const { styles, colors } = useThemedStyles(makeStyles);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const unlockedPacks = CATEGORIES.filter(
    (cat) => cat.tier === 'premium' && isUnlocked(cat.id)
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
        web: { cursor: 'default' },
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
    version: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      letterSpacing: 1.5,
      paddingVertical: SPACING.xl,
    },
  });
}
