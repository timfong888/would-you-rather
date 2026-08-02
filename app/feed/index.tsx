import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import {
  QUESTIONS,
  CATEGORIES,
  getCategoryById,
  type Question,
  type CategoryId,
} from '@/constants/questions';
import { useThemedStyles } from '@/contexts/ThemeContext';
import PageHead from '@/components/PageHead';
import { SEO, SITE_URL } from '@/constants/config';

// ---------------------------------------------------------------------------
// Feed tab types
// ---------------------------------------------------------------------------

type FeedTab = 'for-you' | 'trending' | 'new';

interface FeedItem {
  question: Question;
  totalVotes: number;
  topPct: number;
  topOption: 'A' | 'B';
  isHot: boolean;
  isMajority: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFeedItem(q: Question): FeedItem {
  const totalVotes = q.votesA + q.votesB;
  const pctA = totalVotes > 0 ? Math.round((q.votesA / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;
  const topOption: 'A' | 'B' = pctA >= pctB ? 'A' : 'B';
  const topPct = topOption === 'A' ? pctA : pctB;
  return {
    question: q,
    totalVotes,
    topPct,
    topOption,
    isHot: totalVotes > 1200,
    isMajority: topPct >= 70,
  };
}

function formatVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ---------------------------------------------------------------------------
// Category strip data
// ---------------------------------------------------------------------------

type FilterId = 'all' | CategoryId;

const CATEGORY_FILTERS: { id: FilterId; label: string; emoji: string }[] = [
  { id: 'all', label: 'All', emoji: '✨' },
  ...CATEGORIES.map((c) => ({ id: c.id as FilterId, label: c.label, emoji: c.emoji })),
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryChip({
  item,
  active,
  color,
  onPress,
}: {
  item: (typeof CATEGORY_FILTERS)[number];
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeChipStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: color, borderColor: color },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={styles.chipEmoji}>{item.emoji}</Text>
      <Text style={[styles.chipLabel, active && { color: colors.textOnColor }]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function makeChipStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      }),
    },
    chipEmoji: { fontSize: 13 },
    chipLabel: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
    },
  });
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeTabStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.tabLabel, active && { color: colors.magenta }]}>
        {label}
      </Text>
      {active && <View style={[styles.tabUnderline, { backgroundColor: colors.magenta }]} />}
    </Pressable>
  );
}

function makeTabStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tab: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      position: 'relative',
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    tabLabel: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1.5,
    },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: SPACING.md,
      right: SPACING.md,
      height: 2.5,
      borderRadius: RADIUS.full,
    },
  });
}

// ---------------------------------------------------------------------------
// Question feed card
// ---------------------------------------------------------------------------

function QuestionCard({
  item,
  onPlay,
}: {
  item: FeedItem;
  onPlay: () => void;
}) {
  const { styles, colors } = useThemedStyles(makeCardStyles);
  const { question, totalVotes, topPct, topOption, isHot, isMajority } = item;
  const cat = getCategoryById(question.category);
  const catColor = cat?.color ?? colors.magenta;
  const pctA = Math.round((question.votesA / (totalVotes || 1)) * 100);
  const pctB = 100 - pctA;

  return (
    <View style={[styles.card, { borderColor: `${catColor}30` }]}>
      {/* Card header: category + badges */}
      <View style={styles.cardHeader}>
        <View style={[styles.catBadge, { backgroundColor: `${catColor}18` }]}>
          <Text style={styles.catEmoji}>{cat?.emoji}</Text>
          <Text style={[styles.catLabel, { color: catColor }]}>
            {cat?.label.toUpperCase()}
          </Text>
        </View>

        <View style={styles.badges}>
          {isHot && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
          )}
          {isMajority && (
            <View style={styles.majorityBadge}>
              <Text style={styles.majorityBadgeText}>
                {topPct}% CHOSE {topOption}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Prompt */}
      <Text style={styles.prompt}>WOULD YOU RATHER…</Text>

      {/* Options preview */}
      <View style={styles.options}>
        <View style={[styles.optionRow, { borderLeftColor: colors.optionA }]}>
          <View style={[styles.optionBadge, { backgroundColor: `${colors.optionA}20` }]}>
            <Text style={[styles.optionLetter, { color: colors.optionA }]}>A</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {question.optionA}
          </Text>
        </View>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <View style={[styles.orBubble, { borderColor: `${catColor}50`, backgroundColor: `${catColor}10` }]}>
            <Text style={[styles.orText, { color: catColor }]}>OR</Text>
          </View>
          <View style={styles.orLine} />
        </View>

        <View style={[styles.optionRow, { borderLeftColor: colors.optionB }]}>
          <View style={[styles.optionBadge, { backgroundColor: `${colors.optionB}20` }]}>
            <Text style={[styles.optionLetter, { color: colors.optionB }]}>B</Text>
          </View>
          <Text style={styles.optionText} numberOfLines={2}>
            {question.optionB}
          </Text>
        </View>
      </View>

      {/* Consensus bar */}
      <View style={styles.consensusSection}>
        <View style={styles.consensusBar}>
          <View
            style={[
              styles.consensusFillA,
              { backgroundColor: colors.optionA, width: `${pctA}%` as any },
            ]}
          />
          <View
            style={[
              styles.consensusFillB,
              { backgroundColor: colors.optionB, width: `${pctB}%` as any },
            ]}
          />
        </View>
        <View style={styles.consensusLabels}>
          <Text style={[styles.consensusPct, { color: colors.optionA }]}>{pctA}%</Text>
          <Text style={styles.voteCount}>
            {formatVotes(totalVotes)} votes
          </Text>
          <Text style={[styles.consensusPct, { color: colors.optionB }]}>{pctB}%</Text>
        </View>
      </View>

      {/* Play CTA */}
      <Pressable
        onPress={onPlay}
        style={({ pressed }) => [
          styles.playButton,
          { backgroundColor: catColor },
          pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Text style={styles.playButtonText}>CAST YOUR VOTE →</Text>
      </Pressable>
    </View>
  );
}

function makeCardStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1.5,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...Platform.select({
        web: {
          boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
        },
      }),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: SPACING.xs,
    },
    catBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    catEmoji: { fontSize: 13 },
    catLabel: {
      fontSize: 10,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    badges: {
      flexDirection: 'row',
      gap: SPACING.xs,
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    hotBadge: {
      backgroundColor: '#FFF0E6',
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: '#FF8C42',
    },
    hotBadgeText: {
      color: '#C15800',
      fontSize: 9,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 0.5,
    },
    majorityBadge: {
      backgroundColor: colors.freeBg,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.free,
    },
    majorityBadgeText: {
      color: colors.free,
      fontSize: 9,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 0.5,
    },
    prompt: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 2,
      fontStyle: 'italic',
    },
    options: {
      gap: SPACING.sm,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderLeftWidth: 3,
    },
    optionBadge: {
      width: 30,
      height: 30,
      borderRadius: RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    optionLetter: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
    },
    optionText: {
      flex: 1,
      color: colors.text,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      lineHeight: 20,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    orBubble: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    orText: {
      fontSize: 10,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    consensusSection: {
      gap: SPACING.xs,
    },
    consensusBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
      backgroundColor: colors.surfaceLight,
    },
    consensusFillA: {
      height: '100%',
      borderTopLeftRadius: RADIUS.full,
      borderBottomLeftRadius: RADIUS.full,
    },
    consensusFillB: {
      height: '100%',
      borderTopRightRadius: RADIUS.full,
      borderBottomRightRadius: RADIUS.full,
    },
    consensusLabels: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    consensusPct: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
    },
    voteCount: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.semibold,
    },
    playButton: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.xs,
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      }),
    },
    playButtonText: {
      color: '#FFFFFF',
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
  });
}

// ---------------------------------------------------------------------------
// Main Feed Screen
// ---------------------------------------------------------------------------

export default function FeedScreen() {
  const router = useRouter();
  const { styles, colors } = useThemedStyles(makeStyles);
  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  const feedItems = useMemo(() => {
    let questions = [...QUESTIONS];

    // Apply category filter
    if (activeFilter !== 'all') {
      questions = questions.filter((q) => q.category === activeFilter);
    }

    // Sort by tab
    if (activeTab === 'trending') {
      questions = questions.sort((a, b) => (b.votesA + b.votesB) - (a.votesA + a.votesB));
    } else if (activeTab === 'new') {
      questions = questions.reverse();
    } else {
      // For You: shuffle deterministically — mix trending + variety
      questions = questions.sort((a, b) => {
        const scoreA = (a.votesA + a.votesB) * 0.6 + Math.abs(a.votesA - a.votesB) * 0.4;
        const scoreB = (b.votesA + b.votesB) * 0.6 + Math.abs(b.votesA - b.votesB) * 0.4;
        return scoreB - scoreA;
      });
    }

    return questions.slice(0, 30).map(buildFeedItem);
  }, [activeTab, activeFilter]);

  const handlePlay = (item: FeedItem) => {
    const q = item.question;
    const catQuestions = QUESTIONS.filter((x) => x.category === q.category);
    const idx = catQuestions.findIndex((x) => x.id === q.id);
    router.push(`/game/${q.id}?cat=${q.category}&idx=${Math.max(0, idx)}`);
  };

  const getFilterColor = (id: FilterId) => {
    if (id === 'all') return colors.magenta;
    const cat = getCategoryById(id as CategoryId);
    return cat?.color ?? colors.magenta;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[2]}
    >
      <PageHead
        title="Discover — Would You Rather?"
        description="Browse trending Would You Rather dilemmas across all categories. Cast your vote and see how the crowd votes."
        canonicalUrl={`${SITE_URL}/feed`}
      />

      {/* Screen header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSub}>
            {QUESTIONS.length.toLocaleString()} dilemmas waiting
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/categories')}
          style={({ pressed }) => [styles.browseButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.browseButtonText}>Browse All</Text>
        </Pressable>
      </View>

      {/* Sticky tab bar + category filters */}
      <View style={styles.stickySection}>
        {/* Tabs */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(
            [
              { id: 'for-you', label: 'FOR YOU' },
              { id: 'trending', label: 'TRENDING' },
              { id: 'new', label: 'NEW' },
            ] as { id: FeedTab; label: string }[]
          ).map((tab) => (
            <TabButton
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
            />
          ))}
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {CATEGORY_FILTERS.map((f) => (
            <CategoryChip
              key={f.id}
              item={f}
              active={activeFilter === f.id}
              color={getFilterColor(f.id)}
              onPress={() => setActiveFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Feed results count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsCount}>
          {feedItems.length} dilemmas
        </Text>
        {activeFilter !== 'all' && (
          <Pressable onPress={() => setActiveFilter('all')}>
            <Text style={[styles.clearFilter, { color: colors.magenta }]}>Clear filter ✕</Text>
          </Pressable>
        )}
      </View>

      {/* Feed cards */}
      <View style={styles.feed}>
        {feedItems.map((item) => (
          <QuestionCard
            key={item.question.id}
            item={item}
            onPlay={() => handlePlay(item)}
          />
        ))}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: SPACING.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    headerLeft: {
      gap: 2,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.black,
      letterSpacing: -0.5,
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
    },
    browseButton: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    browseButtonText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
    },
    stickySection: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: SPACING.md,
    },
    chipsScroll: {
      flexGrow: 0,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    resultsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xs,
    },
    resultsCount: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    clearFilter: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    feed: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      gap: SPACING.md,
    },
    bottomPadding: {
      height: SPACING.xxl,
    },
  });
}
