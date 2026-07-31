import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';

interface OptionButtonProps {
  label: 'A' | 'B';
  text: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export default function OptionButton({
  label,
  text,
  selected,
  onPress,
  disabled,
}: OptionButtonProps) {
  const isA = label === 'A';
  const baseColor = isA ? COLORS.optionA : COLORS.optionB;
  const lightColor = isA ? COLORS.optionALight : COLORS.optionBLight;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor: selected ? baseColor : COLORS.border,
          backgroundColor: selected ? `${baseColor}20` : COLORS.surface,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          opacity: disabled && !selected ? 0.5 : 1,
        },
      ]}
    >
      <View style={[styles.labelBadge, { backgroundColor: baseColor }]}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <Text style={[styles.optionText, selected && { color: lightColor }]}>
        {text}
      </Text>
      {selected && (
        <View style={[styles.selectedIndicator, { backgroundColor: baseColor }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
    }),
  },
  labelBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelText: {
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.medium,
    lineHeight: 26,
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
});
