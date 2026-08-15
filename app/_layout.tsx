import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { UnlockedProvider } from '@/contexts/UnlockedContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

function HeaderActions() {
  const router = useRouter();
  return (
    <View style={styles.headerActions}>
      <ThemeToggle />
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.6 }]}
        accessibilityLabel="Settings"
        accessibilityRole="button"
      >
        <Text style={styles.settingsIcon}>⚙️</Text>
      </Pressable>
    </View>
  );
}

function AppLayout() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.text,
          },
          headerShadowVisible: false,
          headerRight: () => <HeaderActions />,
          contentStyle: {
            backgroundColor: colors.background,
          },
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="game/[id]"
          options={{
            title: 'Would You Rather?',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="results/[id]"
          options={{
            title: 'Results',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="complete/[id]"
          options={{
            title: 'Complete',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="unlock/[id]"
          options={{
            title: 'Unlock',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="categories/index"
          options={{
            title: 'Categories',
            headerBackTitle: 'Home',
          }}
        />
        <Stack.Screen
          name="categories/[id]"
          options={{
            title: 'Category',
            headerBackTitle: 'Categories',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerBackTitle: 'Back',
            headerRight: () => <ThemeToggle />,
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            title: 'Privacy Policy',
            headerBackTitle: 'Settings',
          }}
        />
        <Stack.Screen
          name="terms"
          options={{
            title: 'Terms of Service',
            headerBackTitle: 'Settings',
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <UnlockedProvider>
        <AppLayout />
      </UnlockedProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingsBtn: {
    padding: 4,
    ...Platform.select({
      web: { cursor: 'pointer' },
    }),
  },
  settingsIcon: {
    fontSize: 20,
  },
});
