import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontWeight: '700',
            color: COLORS.text,
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: COLORS.background,
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
