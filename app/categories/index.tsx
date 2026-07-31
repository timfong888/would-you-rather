import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, SPACING, RADIUS } from '@/constants/theme';
import { CATEGORIES, getQuestionsByCategory } from '@/constants/questions';
import CategoryCard from '@/components/CategoryCard';

export default function CategoriesScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>All Categories</Text>
        <Text style={styles.subtitle}>
          Choose a category to browse questions
        </Text>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => {
          const questions = getQuestionsByCategory(cat.id);
          return (
            <View key={cat.id} style={styles.gridItem}>
              <CategoryCard
                id={cat.id}
                label={cat.label}
                emoji={cat.emoji}
                color={cat.color}
                questionCount={questions.length}
                onPress={() => router.push(`/categories/${cat.id}`)}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  header: {
    gap: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.extrabold,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  gridItem: {
    width: '47%',
  },
});
