import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

export default function TermsOfServiceScreen() {
  const { styles } = useThemedStyles(makeStyles);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.updated}>Last updated: August 2025</Text>

      <Text style={styles.body}>
        By using Would You Rather? you agree to the following terms. The app is
        provided for entertainment purposes only.
      </Text>

      <Text style={styles.heading}>Use of the App</Text>
      <Text style={styles.body}>
        You may use this app for personal, non-commercial entertainment. You may
        not reproduce, distribute, or create derivative works from the app
        content without permission.
      </Text>

      <Text style={styles.heading}>Content</Text>
      <Text style={styles.body}>
        Questions and other content are intended for adults and mature teens.
        Some premium packs contain questions on mature themes. Use your
        discretion when playing with younger audiences.
      </Text>

      <Text style={styles.heading}>Disclaimer</Text>
      <Text style={styles.body}>
        The app is provided "as is" without warranties of any kind. We are not
        liable for any damages arising from your use of the app.
      </Text>

      <Text style={styles.heading}>Governing Law</Text>
      <Text style={styles.body}>
        These terms are governed by the laws of the State of California, United
        States, without regard to conflict of law principles.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        For questions about these terms, contact us through the app's official
        support channel.
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
