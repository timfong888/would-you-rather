import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

export default function PrivacyPolicyScreen() {
  const { styles } = useThemedStyles(makeStyles);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: August 2026</Text>

      <Text style={styles.body}>
        Would You Rather? is a locally-run game that stores all data on your
        device only. We do not collect, transmit, or share any personal
        information.
      </Text>

      <Text style={styles.heading}>Data We Store Locally</Text>
      <Text style={styles.body}>
        Your answered questions, unlocked packs, and theme preference are saved
        in your browser's localStorage. This data never leaves your device and
        is not accessible to us or any third party.
      </Text>

      <Text style={styles.heading}>Analytics</Text>
      <Text style={styles.body}>
        This app does not use any analytics, tracking pixels, or third-party
        SDKs that collect user data.
      </Text>

      <Text style={styles.heading}>Children</Text>
      <Text style={styles.body}>
        We do not knowingly collect information from children under 13. The game
        contains no registration or account creation of any kind.
      </Text>

      <Text style={styles.heading}>Changes</Text>
      <Text style={styles.body}>
        If this policy changes materially, the updated date at the top of this
        page will reflect the revision.
      </Text>

      <View style={styles.bottomPadding} />
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
    },
    title: {
      color: colors.text,
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.extrabold,
      marginBottom: SPACING.xs,
    },
    updated: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      marginBottom: SPACING.xl,
    },
    heading: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      marginTop: SPACING.lg,
      marginBottom: SPACING.xs,
    },
    body: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      lineHeight: 24,
    },
    bottomPadding: {
      height: SPACING.xxl,
    },
  });
}
