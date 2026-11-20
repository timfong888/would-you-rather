import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import LegalFooter from '@/components/LegalFooter';
import { POLICY_UPDATED, SUPPORT_EMAIL } from '@/constants/legal';

export default function PrivacyPolicyScreen() {
  const { styles } = useThemedStyles(makeStyles);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: {POLICY_UPDATED}</Text>

      <Text style={styles.body}>
        This policy covers the Would You Rather? website and iPhone app. There
        are no accounts. We do not ask for your name or email address, and we
        do not store your IP address.
      </Text>

      <Text style={styles.heading}>Votes</Text>
      <Text style={styles.body}>
        When you answer a question, we store which question it was, which option
        you chose, when you answered, a random anonymous ID made on your device,
        and your country and region (coarse, for example "US, CA"). We use these
        to show how everyone voted and to publish aggregate results. The ID is
        random and is not linked to your name or any other account.
      </Text>

      <Text style={styles.heading}>Kids & Family</Text>
      <Text style={styles.body}>
        On Kids & Family screens we send no analytics and store no device ID,
        no region and no persistent identifier of any kind. When a child answers
        a Kids & Family question we store only the question, the option and the
        time, so the answer cannot be linked to a device. Purchase screens in
        Kids & Family are behind a grown-ups-only check.
      </Text>

      <Text style={styles.heading}>Analytics</Text>
      <Text style={styles.body}>
        On all other screens we use PostHog (a third-party analytics service,
        servers in the United States) to understand which screens and features
        are used and where people drop off. It receives the random anonymous ID,
        events such as viewing a question, answering, sharing and opening the
        paywall, and basic device information such as app version and operating
        system. It does not receive your name, email or contacts, and we do not
        use it for advertising or to track you across other apps or websites.
        PostHog is never started on Kids & Family screens.
      </Text>

      <Text style={styles.heading}>Purchases</Text>
      <Text style={styles.body}>
        In-app purchases are processed by Apple. We use RevenueCat (a
        third-party purchase service) to check which categories you have
        unlocked and to restore them. RevenueCat receives an anonymous app user
        ID and your purchase receipt from Apple. We never see your payment
        details or Apple ID.
      </Text>

      <Text style={styles.heading}>Data We Store on Your Device</Text>
      <Text style={styles.body}>
        Your answered questions, unlocked categories and theme preference are
        saved on your device (in the browser's local storage on the website).
        This data stays on your device. Deleting the app or clearing your
        browser data removes it.
      </Text>

      <Text style={styles.heading}>Children</Text>
      <Text style={styles.body}>
        The app is a general-audience app rated 13+ and is not in the Kids
        category of the App Store. The Kids & Family category is meant for
        families to play together, and collects no personal data (see above). We
        do not knowingly collect personal information from children under 13.
      </Text>

      <Text style={styles.heading}>Your Choices and Data Deletion</Text>
      <Text style={styles.body}>
        You can delete all data on your device by deleting the app or clearing
        your browser data. Votes on our servers are tied only to a random ID, so
        we cannot tell which votes are yours. If you want us to delete votes,
        analytics data or purchase records linked to an ID or receipt you can
        give us, email {SUPPORT_EMAIL} and we will delete them.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        Questions about this policy: {SUPPORT_EMAIL}. Help with the app is on
        the support page, https://www.wouldyourather.fyi/support.
      </Text>

      <Text style={styles.heading}>Changes</Text>
      <Text style={styles.body}>
        If this policy changes materially, the updated date at the top of this
        page will reflect the revision.
      </Text>

      <LegalFooter />
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
