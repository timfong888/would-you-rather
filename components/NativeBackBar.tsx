import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

/**
 * Back and Home for headerless native screens (#118). Landing pages hide the stack header so the web
 * page keeps a single <h1>; on iPhone that left no way out. Native only: renders nothing on web.
 * Place it inside a SafeScrollView so the top inset keeps it below the status bar and Dynamic Island.
 */
export default function NativeBackBar() {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  if (Platform.OS === 'web') return null;
  return (
    <View style={styles.bar}>
      {router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.text}>‹ Back</Text>
        </Pressable>
      ) : (
        <View />
      )}
      <Pressable
        onPress={() => router.replace('/')}
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Go to home"
      >
        <Text style={styles.text}>Home</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
    },
    button: {
      minHeight: 44,
      justifyContent: 'center',
    },
    text: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.semibold,
      color: colors.primary,
    },
  });
}
