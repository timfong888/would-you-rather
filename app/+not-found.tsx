import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SPACING } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🤷</Text>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    textAlign: 'center',
  },
  link: {
    marginTop: SPACING.sm,
  },
  linkText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
  },
});
