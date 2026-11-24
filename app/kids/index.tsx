import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import { CATEGORIES, getAccessibleQuestions } from '@/constants/questions';
import { SITE_URL } from '@/constants/config';
import PageHead from '@/components/PageHead';
import SafeScrollView from '@/components/SafeScrollView';
import ModeSwitch from '@/components/ModeSwitch';
import AgeChips from '@/components/AgeChips';
import KidsCategoryRow from '@/components/KidsCategoryRow';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { DEFAULT_BAND_ID, categoriesForBand, randomKidsCategories } from '@/lib/browse';

/**
 * With kids mode (spec §2.1). A kids route (lib/kidsPaths.ts): no analytics, no stored ID, nothing persisted. The age chip
 * is plain component state, gone when the parent leaves. It lists the teen category too, but its own screens follow
 * the adult rules.
 */
export default function WithKidsScreen() {
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const { isUnlocked } = useUnlocked();
  const [bandId, setBandId] = useState(DEFAULT_BAND_ID);
  const shown = categoriesForBand(CATEGORIES, bandId);

  // Only ever a question the player can open now: a prefix of the category list, so indexOf is the category index.
  const pickOne = () => {
    const pool = randomKidsCategories(CATEGORIES, bandId);
    if (!pool.length) return;
    const cat = pool[Math.floor(Math.random() * pool.length)];
    const questions = getAccessibleQuestions(cat, isUnlocked(cat.id));
    if (!questions.length) return;
    const q = questions[Math.floor(Math.random() * questions.length)];
    router.push(`/game/${q.id}?cat=${cat.id}&idx=${questions.indexOf(q)}`);
  };

  return (
    <SafeScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PageHead
        title="Would You Rather with kids: pick a topic by age"
        description="Would You Rather questions for kids and families, grouped by topic and age. Eight questions free in every category."
        canonicalUrl={`${SITE_URL}/kids`}
      />
      <ModeSwitch mode="kids" />

      <View style={styles.hero}>
        <Text style={styles.title} role="heading" aria-level={1}>WITH KIDS</Text>
        <Text style={styles.subtitle}>Pick a topic for the age you are playing with.</Text>
      </View>

      <AgeChips selected={bandId} onSelect={setBandId} />

      <Pressable
        onPress={pickOne}
        accessibilityRole="button"
        accessibilityLabel="Pick one for me"
        style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.pickText}>PICK ONE FOR ME 🎲</Text>
      </Pressable>

      <View style={styles.list}>
        {shown.map((cat) => (
          <KidsCategoryRow key={cat.id} category={cat} onPress={() => router.push(`/categories/${cat.id}`)} />
        ))}
      </View>
    </SafeScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
    hero: { alignItems: 'center', gap: SPACING.xs, paddingTop: SPACING.sm },
    title: { color: colors.text, fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.black, letterSpacing: 4, textAlign: 'center' },
    subtitle: { color: colors.textSecondary, fontSize: FONTS.sizes.md, textAlign: 'center' },
    pickButton: {
      alignSelf: 'center',
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    pickText: { color: colors.textOnColor, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.black, letterSpacing: 1 },
    list: { gap: SPACING.sm },
  });
}
