import React from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import LegalFooter from '@/components/LegalFooter';
import { SUPPORT_EMAIL } from '@/constants/legal';

export default function SupportScreen() {
  const { styles } = useThemedStyles(makeStyles);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Support</Text>
      <Text style={styles.updated}>Would You Rather? help and contact</Text>

      <Text style={styles.heading}>Contact us</Text>
      <Text style={styles.body}>
        Email {SUPPORT_EMAIL} for help, bug reports or feedback. Please include
        your iPhone model and iOS version.
      </Text>

      <Text style={styles.heading}>Restore purchases</Text>
      <Text style={styles.body}>
        Open a locked category, then tap Restore Purchases on the unlock screen.
        Use the same Apple ID you bought with. Purchases are one-time unlocks,
        not subscriptions.
      </Text>

      <Text style={styles.heading}>Refunds and billing</Text>
      <Text style={styles.body}>
        Apple handles payment, so refund requests go through Apple at
        reportaproblem.apple.com.
      </Text>

      <Text style={styles.heading}>Kids & Family</Text>
      <Text style={styles.body}>
        Kids & Family is free. Purchase screens there start with a grown-ups-only
        check. Other categories contain mature themes meant for teens and
        adults.
      </Text>

      <Text style={styles.heading}>Privacy and data deletion</Text>
      <Text style={styles.body}>
        Read the privacy policy at https://www.wouldyourather.fyi/privacy. To
        ask us to delete data, email {SUPPORT_EMAIL}.
      </Text>

      <LegalFooter />
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
