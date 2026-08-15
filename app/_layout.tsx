import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { UnlockedProvider } from '@/contexts/UnlockedContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { AnalyticsProvider } from '@/contexts/AnalyticsContext';
import ThemeToggle from '@/components/ThemeToggle';

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
          headerRight: () => <ThemeToggle />,
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
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <UnlockedProvider>
          <AppLayout />
        </UnlockedProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
