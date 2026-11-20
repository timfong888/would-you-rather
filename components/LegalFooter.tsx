import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { FONTS, SPACING, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { COPYRIGHT_LINE } from '@/constants/legal';

export default function LegalFooter() {
  const { styles } = useThemedStyles(makeStyles);
  return <Text style={styles.footer}>{COPYRIGHT_LINE}</Text>;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    footer: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      marginTop: SPACING.xl,
    },
  });
}
