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
      <Text style={styles.updated}>Last updated: November 2026</Text>

      <Text style={styles.body}>
        Would You Rather? keeps most of its data on your device. The one thing
        we store on our servers is your answers to questions, described under
        "Votes" below. We do not collect your name, email address or IP address.
      </Text>

      <Text style={styles.heading}>Votes</Text>
      <Text style={styles.body}>
        When you answer a question, we store which question it was, which option
        you chose, when you answered, a random anonymous ID made on your device,
        and your country and region (coarse, for example "US, CA"). We use
        these to show how everyone voted and to publish aggregate results. We do
        not store your IP address. Only one answer per question is counted for
        each device. In the Kids & Family category we store no device ID and
        no region at all, only the question, the option and the time.
      </Text>

      <Text style={styles.heading}>Data We Store Locally</Text>
      <Text style={styles.body}>
        Your answered questions, unlocked packs, and theme preference are saved
        in your browser's localStorage. This data never leaves your device and
        is not accessible to us or any third party.
      </Text>

      <Text style={styles.heading}>Analytics</Text>
      <Text style={styles.body}>
        We use PostHog to understand which questions and screens are used, for
        example when a category is opened or a paywall is viewed. Events are
        linked to a random anonymous ID created on your device. We do not
        collect your name, email address or precise location, and we do not use
        the data for advertising or sell it. PostHog receives standard request
        data such as your IP address. We do not use PostHog on the Kids &
        Family pages or questions.
      </Text>

      <Text style={styles.heading}>Purchases</Text>
      <Text style={styles.body}>
        In-app purchases are processed by Apple. We use RevenueCat to validate
        purchases and to restore them. RevenueCat receives an anonymous app user
        ID and your purchase history for this app, not your name or Apple ID.
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
