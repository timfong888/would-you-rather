import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

interface OptionButtonProps {
  label: 'A' | 'B';
  text: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  votesA?: number;
  votesB?: number;
  showConsensus?: boolean;
}

export default function OptionButton({
  label,
  text,
  selected,
  onPress,
  disabled,
  votesA = 0,
  votesB = 0,
  showConsensus = false,
}: OptionButtonProps) {
  const { styles, colors } = useThemedStyles(makeStyles);

  const isA = label === 'A';
  const baseColor = isA ? colors.optionA : colors.optionB;

  const totalVotes = votesA + votesB;
  const percentage = totalVotes > 0
    ? Math.round(((isA ? votesA : votesB) / totalVotes) * 100)
    : 50;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor: selected ? baseColor : colors.border,
          backgroundColor: selected ? `${baseColor}15` : colors.surface,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.labelBadge, { backgroundColor: selected ? baseColor : `${baseColor}20`, borderWidth: selected ? 0 : 1.5, borderColor: baseColor }]}>
          <Text style={[styles.labelText, { color: selected ? colors.textOnColor : baseColor }]}>
            {label}
          </Text>
        </View>
        <Text style={[styles.optionText, selected && { color: baseColor }]}>
          {text}
        </Text>
      </View>

      {showConsensus && (
        <View style={styles.consensusRow}>
          <View style={styles.consensusBarTrack}>
            <View
              style={[
                styles.consensusBarFill,
                { backgroundColor: `${baseColor}60`, width: `${percentage}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.consensusPct, { color: selected ? baseColor : colors.textMuted }]}>
            {percentage}%
          </Text>
          <Text style={styles.consensusLabel}>VOTER CONSENSUS</Text>
        </View>
      )}

      {selected && (
        <View style={[styles.selectedBar, { backgroundColor: baseColor }]} />
      )}
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      borderWidth: 2,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.sm,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
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
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
    },
    optionText: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.medium,
      lineHeight: 22,
    },
    consensusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: 2,
    },
    consensusBarTrack: {
      flex: 1,
      height: 6,
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    consensusBarFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    consensusPct: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      minWidth: 32,
      textAlign: 'right',
    },
    consensusLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: FONTS.weights.semibold,
      letterSpacing: 0.8,
    },
    selectedBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      borderTopLeftRadius: RADIUS.lg,
      borderBottomLeftRadius: RADIUS.lg,
    },
  });
}
