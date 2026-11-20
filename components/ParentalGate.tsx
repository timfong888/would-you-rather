import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { checkAnswer, makeChallenge } from '@/lib/parentalGate';

interface Props {
  onPass: () => void;
  onCancel: () => void;
}

/** Full-screen "grown-ups only" check shown before a paywall opened from kids/family content. */
export function ParentalGate({ onPass, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const { styles, colors } = useThemedStyles(makeStyles);
  const [challenge, setChallenge] = useState(() => makeChallenge());
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const prompt = useMemo(() => challenge.prompt, [challenge]);

  const submit = () => {
    if (checkAnswer(challenge, value)) {
      onPass();
      return;
    }
    setWrong(true);
    setValue('');
    setChallenge(makeChallenge());
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl }]}>
      <Text style={styles.title}>Grown-ups only</Text>
      <Text style={styles.body}>Purchases are for parents. To continue, solve this:</Text>
      <Text style={styles.prompt} accessibilityLabel={`What is ${prompt}`}>{prompt} = ?</Text>
      <TextInput
        value={value}
        onChangeText={(t) => { setValue(t); if (wrong) setWrong(false); }}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        placeholder="Answer"
        placeholderTextColor={colors.textMuted}
        returnKeyType="go"
        maxLength={3}
        style={styles.input}
        accessibilityLabel="Answer"
      />
      {wrong && <Text style={styles.error}>That was not right. Here is a new one.</Text>}
      <Pressable onPress={submit} style={styles.primary} accessibilityRole="button">
        <Text style={styles.primaryText}>CONTINUE</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.secondary} accessibilityRole="button">
        <Text style={styles.secondaryText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingHorizontal: SPACING.lg },
    title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: colors.text, marginBottom: SPACING.sm },
    body: { fontSize: FONTS.sizes.md, color: colors.textSecondary, textAlign: 'center', marginBottom: SPACING.lg },
    prompt: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.bold, color: colors.text, marginBottom: SPACING.lg },
    input: {
      width: 160,
      textAlign: 'center',
      fontSize: 24,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.md,
    },
    error: { fontSize: FONTS.sizes.sm, color: colors.secondary, marginBottom: SPACING.md },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      marginTop: SPACING.sm,
    },
    primaryText: { fontWeight: FONTS.weights.bold, color: '#FFFFFF', letterSpacing: 1 },
    secondary: { marginTop: SPACING.lg, padding: SPACING.sm },
    secondaryText: { color: colors.textSecondary },
  });
