export const LIGHT_COLORS = {
  background: '#F5E6F0',
  surface: '#FFFFFF',
  surfaceLight: '#EDD5E8',
  primary: '#5C54E8',
  primaryLight: '#7A74F0',
  secondary: '#E8316A',
  accent: '#4ECDC4',
  magenta: '#D63384',
  magentaLight: '#E055A3',
  gold: '#C9A84C',
  goldLight: '#DFC26A',
  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9090A8',
  textOnColor: '#FFFFFF',
  optionA: '#5C54E8',
  optionALight: '#7A74F0',
  optionB: '#E8316A',
  optionBLight: '#F05585',
  border: '#E4C4DA',
  success: '#2D9E6B',
  warning: '#C9A84C',
  premium: '#B8920A',
  premiumBg: '#FFF8E7',
  free: '#1F8C5A',
  freeBg: '#E8F7EF',
  trialBannerBg: '#F0C5E0',
  trialBannerText: '#6B1A4A',
};

export const DARK_COLORS = {
  background: '#12121F',
  surface: '#1E1E32',
  surfaceLight: '#2A2A45',
  primary: '#7A74F0',
  primaryLight: '#9B96F5',
  secondary: '#F05585',
  accent: '#4ECDC4',
  magenta: '#E055A3',
  magentaLight: '#F07ABA',
  gold: '#DFC26A',
  goldLight: '#E8D08A',
  text: '#F0F0FF',
  textSecondary: '#B0B0CC',
  textMuted: '#7070A0',
  textOnColor: '#FFFFFF',
  optionA: '#7A74F0',
  optionALight: '#9B96F5',
  optionB: '#F05585',
  optionBLight: '#F585A5',
  border: '#2E2E50',
  success: '#3DBF82',
  warning: '#DFC26A',
  premium: '#DFC26A',
  premiumBg: '#2A2000',
  free: '#3DBF82',
  freeBg: '#0A2018',
  trialBannerBg: '#2A0A20',
  trialBannerText: '#E090C8',
};

// Keep COLORS as the light palette for backwards compatibility
export const COLORS = LIGHT_COLORS;

export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export type ThemeColors = typeof LIGHT_COLORS;
