import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

interface VoteBarProps {
  label: 'A' | 'B';
  text: string;
  votes: number;
  totalVotes: number;
  userVoted: boolean;
  animate?: boolean;
}

export default function VoteBar({
  label,
  text,
  votes,
  totalVotes,
  userVoted,
  animate = true,
}: VoteBarProps) {
  const { styles, colors } = useThemedStyles(makeStyles);

  const isA = label === 'A';
  const color = isA ? colors.optionA : colors.optionB;
  const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animate) {
      Animated.timing(widthAnim, {
        toValue: percentage,
        duration: 800,
        delay: isA ? 0 : 100,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(percentage);
    }
  }, [percentage, animate]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {text}
          </Text>
        </View>
        <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
      </View>

      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={styles.voteCount}>
        {votes.toLocaleString()} votes
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: SPACING.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flex: 1,
    },
    badge: {
      width: 28,
      height: 28,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    badgeText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.bold,
    },
    optionText: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.medium,
      flex: 1,
      lineHeight: 20,
    },
    percentage: {
      fontSize: FONTS.sizes.xl,
      fontWeight: FONTS.weights.extrabold,
      flexShrink: 0,
    },
    barTrack: {
      height: 10,
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    voteCount: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
    },
  });
}
