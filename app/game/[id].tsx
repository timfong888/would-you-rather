import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, useRootNavigationState } from 'expo-router';
import { FONTS, SPACING, RADIUS, type ThemeColors } from '@/constants/theme';
import { getQuestionById, getCategoryById, getCategoryQuestions, getFreeQuestionCount, isQuestionLocked } from '@/constants/questions';
import type { CategoryId } from '@/constants/questions';
import { SITE_URL } from '@/constants/config';
import PageHead from '@/components/PageHead';
import JsonLd from '@/components/JsonLd';
import { questionPageJsonLd } from '@/lib/seo';
import OptionButton from '@/components/OptionButton';
import { useAnsweredQuestions } from '@/hooks/useAnsweredQuestions';
import { useUnlocked } from '@/contexts/UnlockedContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { track, buildShareUrl } from '@/lib/analytics';
import { shareLink, shareEvents, SHARE_FEEDBACK } from '@/lib/shareQuestion';
import { decodeFriend, matchOutcome, pickLine, headingFor, shareText, uiText, matchEvent } from '@/lib/matchShare';
import { castVote, fetchTally, getLockedChoice } from '@/lib/votes';
import { reconcileChoice } from '@/lib/votes-core';
import { formatResult, INVITE_TITLE, INVITE_TEXT, type ResultDisplay } from '@/lib/results';
import { recipientEvents, recipientIntro, theyPickedLine, type RecipientAction } from '@/lib/recipient';

// Shape of the link_id that buildShareUrl() emits (RFC 4122 v4 UUID).
const SHARE_LINK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Copy for browsers without the async clipboard API (e.g. an insecure context). */
function legacyCopy(value: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('textarea');
  el.value = value;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(el);
  }
}

export default function GameScreen() {
  const { id, cat, idx, link_id, f } = useLocalSearchParams<{ id: string; cat: string; idx: string; link_id: string; f: string }>();
  const router = useRouter();
  const { isUnlocked } = useUnlocked();
  const { styles, colors } = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // Real result for this question. Stays the invite until the server answers,
  // and whenever there are fewer than VOTE_THRESHOLD votes (#65).
  const [result, setResult] = useState<ResultDisplay>({ kind: 'invite' });
  const { markAnswered, refresh } = useAnsweredQuestions();
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  // Arriving from a share link, the reveal sits below the options: scroll to it after the tap (#134).
  const scrollRef = useRef<ScrollView>(null);
  const actionsY = useRef(0);
  const { incomingLinkId, incomingGeneration, visitorId } = useAnalytics();

  const question = getQuestionById(id);
  // The category always comes from the question itself (the URL's `cat` is a
  // hint, never a source of truth), so a bare /game/:id link still gates.
  const catId = (question?.category ?? (cat as CategoryId | undefined)) as CategoryId | undefined;
  const category = catId ? getCategoryById(catId) : undefined;
  const categoryQuestions = catId ? getCategoryQuestions(catId) : [];
  // Likewise the index is the question's real position, not the URL's `idx`.
  const realIdx = question ? categoryQuestions.findIndex((q) => q.id === question.id) : -1;
  const currentIdx = realIdx >= 0 ? realIdx : (idx !== undefined ? parseInt(idx, 10) || 0 : 0);
  const totalInCategory = categoryQuestions.length;

  // Self-guard: a locked question reached by typing a URL is bounced to the
  // category page (which shows it locked with an Unlock affordance).
  // Exception: arriving via a share link (link_id) — the shared question is
  // intentionally playable as the hook of the share loop; the gate still
  // applies the moment they try to continue.
  //
  // This exception is NOT a security gate. It is intentionally permissive
  // for the sharing UX: link_ids are generated client-side (lib/analytics
  // buildShareUrl) with no server to validate against, so anyone can forge a
  // v4 UUID (e.g. 00000000-0000-4000-8000-000000000000) and play one locked
  // question per URL. The shape check only keeps accidental or malformed
  // params from triggering the exception. Real enforcement needs server-side
  // entitlements (see docs/owner-access.md, "Related client-side gating limits").
  // The friend's pick from a match-share link (#92). It also counts as arriving via a share
  // link, so a shared kids question (whose link has no link_id) stays playable.
  // `friend` is their pick, or 'ask' for a link shared before answering (no pick yet).
  const friend = decodeFriend(f);
  const friendPick = friend === 'A' || friend === 'B' ? friend : null;
  const arrivedViaShare = (typeof link_id === 'string' && SHARE_LINK_ID_RE.test(link_id)) || friend !== null;
  const currentLocked = !!(category && question && isQuestionLocked(category, currentIdx, isUnlocked(category.id)));
  const mustRedirect = currentLocked && !arrivedViaShare;
  // On a cold deep link the root navigator may not be mounted on first render;
  // navigating before it is ready throws, so wait for the root state key.
  const navReady = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (mustRedirect && category && navReady) router.replace(`/categories/${category.id}`);
  }, [mustRedirect, category, navReady, router]);

  // Revisiting a question whose vote the server already holds (reload, back button,
  // shared link): restore and lock that answer instead of letting it be answered again.
  // Read-only: it shows the counts but never sends a vote. Answers saved by older
  // versions (never sent to the server) are not locked, so those players can still vote.
  const restoredChoice = question ? getLockedChoice(question.id) ?? undefined : undefined;
  useEffect(() => {
    if (!question || !restoredChoice || confirmed) return;
    let live = true;
    setSelected(restoredChoice);
    setConfirmed(true);
    fetchTally(question.id).then((t) => {
      if (live) setResult(formatResult(t));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, restoredChoice]);

  // Every hook must run before the early returns below: revoking owner access
  // while this screen is mounted flips `mustRedirect` and the next render
  // returns early, which would otherwise render fewer hooks and throw.
  // Share the question: before confirming ("challenge a friend first") and after
  // (the "send it to someone" prompt). Works in every category. The Kids & Family
  // category sends no analytics at all (the shared link is the bare question URL: no link_id or generation).
  const isKidsCategory = catId === 'kids-family';
  const runShare = useCallback(async (shareUrl: string, text: string, copyMessage = false) => {
    const web = Platform.OS === 'web' && typeof navigator !== 'undefined';
    const result = await shareLink({
      title: 'Would You Rather?',
      text,
      url: shareUrl,
      // Without a share sheet, keep the message with its link (match actions).
      copyText: copyMessage ? `${text}\n${shareUrl}` : undefined,
      nav: web ? (navigator as any) : undefined,
      legacyCopy: web ? legacyCopy : undefined,
      nativeShare: Platform.OS === 'web' ? undefined : (o) => Share.share(o),
      os: Platform.OS === 'android' ? 'android' : 'ios',
    });
    const message = SHARE_FEEDBACK[result];
    if (message) {
      setCopyFeedback(message);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  }, [setCopyFeedback]);

  const handleChallengeShare = useCallback(async (surface: 'game_challenge' | 'game_result' = 'game_challenge') => {
    // After answering, the link carries this player's pick so the friend can see if they match (#92).
    // Before answering the link says so ('ask'), so the friend's answer can be sent back.
    const myPick = surface === 'game_result' && confirmed && selected ? selected : 'ask';
    const { url: shareUrl, linkId } = buildShareUrl(id ?? '', incomingGeneration, isKidsCategory, myPick);

    // Kids & Family: no events and no link_id/gen in the shared URL (see shareEvents).
    for (const ev of shareEvents({
      kids: isKidsCategory,
      questionId: id ?? '',
      surface,
      linkId,
      visitorId,
      incomingLinkId,
      incomingGeneration,
    })) {
      track(ev.name, ev.props);
    }

    const intro = shareText(isKidsCategory, myPick === 'ask' ? 'first_before' : 'first_after');
    await runShare(shareUrl, `${intro}\n${question?.optionA} — OR — ${question?.optionB}`);
  }, [question, id, selected, confirmed, incomingGeneration, incomingLinkId, visitorId, isKidsCategory, runShare]);

  // Match share (#92): once this player has an answer, compare it with the friend's pick
  // from the link. Computed in the browser only; nothing is stored or sent.
  const outcome = confirmed && selected && friendPick ? matchOutcome(selected, friendPick) : null;
  // Arrived on a share made before answering, and has now answered: offer "Tell them".
  const asked = confirmed && !!selected && friend === 'ask';
  const matchLine = useMemo(
    () => (outcome ? pickLine(isKidsCategory, outcome) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outcome, isKidsCategory, id],
  );
  useEffect(() => {
    if (!friend || !question) return;
    for (const ev of matchEvent('opened', { kids: isKidsCategory, questionId: question.id, visitorId })) {
      track(ev.name, ev.props);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, friend]);
  useEffect(() => {
    if (!confirmed || !arrivedViaShare) return;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, actionsY.current - SPACING.lg), animated: true }), 50);
    return () => clearTimeout(t);
  }, [confirmed, arrivedViaShare]);
  useEffect(() => {
    if (!outcome || !question) return;
    for (const ev of matchEvent('answered', { kids: isKidsCategory, questionId: question.id, visitorId, outcome })) {
      track(ev.name, ev.props);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, question?.id]);

  if (!question) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Question not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (mustRedirect) return null;

  const catColor = category?.color ?? colors.magenta;
  const isLastInCategory = catId ? currentIdx >= totalInCategory - 1 : false;
  const nextIdx = currentIdx + 1;
  const nextQuestion = catId && nextIdx < categoryQuestions.length ? categoryQuestions[nextIdx] : null;
  // Is the next question behind the unlock? (premium trial ended, or the free
  // set of a free category is finished and the expansion pack starts.)
  const nextLocked = !!(category && nextQuestion && isQuestionLocked(category, nextIdx, isUnlocked(category.id)));
  // Finishing the free set of a free category is a real milestone: celebrate
  // it on the complete screen (which carries the expansion upsell) instead of
  // dropping straight onto the paywall. Premium trials keep the direct paywall.
  // Only the exact last-free → first-locked step counts: someone who arrived
  // via a share link on an expansion question and continues goes to the
  // paywall, not to a "you finished the free set" screen they never played.
  const endsFreeSet =
    nextLocked &&
    category !== undefined &&
    category.tier === 'free' &&
    currentIdx + 1 === getFreeQuestionCount(category);

  // Funnel events for someone who opened a shared link (#134). Kids items send nothing.
  const trackRecipient = (action: RecipientAction, surface?: string, outcomeNow = outcome) => {
    if (!arrivedViaShare || !question) return;
    for (const ev of recipientEvents(action, {
      kids: isKidsCategory,
      questionId: question.id,
      category: catId,
      linkId: incomingLinkId,
      generation: incomingGeneration,
      visitorId,
      friend,
      outcome: outcomeNow,
      surface,
    })) {
      track(ev.name, ev.props);
    }
  };

  const confirmChoice = (choice: 'A' | 'B') => {
    if (confirmed) return;
    setSelected(choice);
    setConfirmed(true);
    markAnswered(question!.id, choice);
    const votedQuestionId = question!.id;
    const tapped = choice;
    castVote(votedQuestionId, tapped).then(({ tally, choice }) => {
      // Ignore a late answer if the player has already moved to another question.
      if (votedQuestionId !== question?.id) return;
      setResult(formatResult(tally));
      // First vote wins on the server: show and keep the answer it actually holds.
      const kept = reconcileChoice(tapped, choice);
      if (kept !== tapped) {
        setSelected(kept);
        markAnswered(votedQuestionId, kept);
      }
    });
    track('question_answered', {
      question_id: question!.id,
      category: catId ?? undefined,
      choice,
      visitor_id: visitorId,
    });
    trackRecipient('answered', undefined, friendPick ? matchOutcome(choice, friendPick) : null);
    if (incomingLinkId) {
      track('visitor_answered_after_link', {
        link_id: incomingLinkId,
        question_id: question!.id,
        visitor_id: visitorId,
      });
    }
  };

  const handleConfirm = () => {
    if (selected) confirmChoice(selected);
  };

  // Arriving from a share link, one tap answers: no confirm step (#134).
  const handleOptionPress = (choice: 'A' | 'B') => {
    if (confirmed) return;
    if (arrivedViaShare) confirmChoice(choice);
    else setSelected(choice);
  };

  // Send the result back: the link carries this player's pick, so the friend sees it too.
  const handleTellThem = async () => {
    if (!(outcome || asked) || !selected) return;
    const { url: replyUrl } = buildShareUrl(id ?? '', incomingGeneration, isKidsCategory, selected);
    for (const ev of matchEvent('reply_sent', { kids: isKidsCategory, questionId: id ?? '', visitorId, outcome: outcome ?? undefined })) {
      track(ev.name, ev.props);
    }
    const key = outcome === 'matched' ? 'tell_matched' : outcome === 'different' ? 'tell_different' : 'tell_asked';
    await runShare(replyUrl, shareText(isKidsCategory, key, matchLine ?? ''), true);
  };

  // Share the next question in this category with the same friend, before answering.
  const handleAskAnother = async () => {
    if (!nextQuestion || nextLocked) return;
    const { url: nextUrl, linkId: nextLinkId } = buildShareUrl(nextQuestion.id, incomingGeneration, isKidsCategory, 'ask');
    for (const ev of shareEvents({
      kids: isKidsCategory,
      questionId: nextQuestion.id,
      surface: 'game_match_next',
      linkId: nextLinkId,
      visitorId,
      incomingLinkId,
      incomingGeneration,
    })) {
      track(ev.name, ev.props);
    }
    await runShare(
      nextUrl,
      `${shareText(isKidsCategory, 'ask_another')}\n${nextQuestion.optionA} — OR — ${nextQuestion.optionB}`,
      true,
    );
  };

  const handleNext = () => {
    if (!selected) return;

    if (isLastInCategory && catId) {
      router.push(`/complete/${catId}?voted=${selected}&q=${id}`);
      return;
    }

    if (nextQuestion && catId) {
      if (endsFreeSet) {
        router.push(`/complete/${catId}?voted=${selected}&q=${id}`);
        return;
      }
      if (nextLocked) {
        router.push(`/unlock/${catId}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${catId}&idx=${nextIdx}`);
    } else {
      router.push('/');
    }
  };

  // Recipient next steps (#134): the next question in this category, or a share back with this pick.
  const handlePlayAnother = () => {
    trackRecipient('play_another');
    handleNext();
  };
  const handleSendBack = async () => {
    trackRecipient('send_back', outcome || asked ? 'tell_them' : 'share_pick');
    if (outcome || asked) await handleTellThem();
    else await handleChallengeShare('game_result');
  };

  // Skip is hidden in the UI when the next question is locked, but keep the
  // routing consistent with handleNext in case that changes.
  const handleSkip = () => {
    if (nextQuestion && catId) {
      if (endsFreeSet) {
        router.push(`/complete/${catId}?q=${id}`);
        return;
      }
      if (nextLocked) {
        router.push(`/unlock/${catId}`);
        return;
      }
      router.push(`/game/${nextQuestion.id}?cat=${catId}&idx=${nextIdx}`);
    } else {
      router.push('/categories');
    }
  };

  const handleLeaveCategory = () => {
    router.push('/categories');
  };

  // Real percentages only, from the server, at or above the vote threshold.
  const pctFor = (label: 'A' | 'B'): number | undefined =>
    confirmed && result.kind === 'percent' ? (label === 'A' ? result.a : result.b) : undefined;

  const pageTitle = `Would You Rather: ${question.optionA} — or — ${question.optionB}?`;
  const truncatedTitle = pageTitle.length > 100
    ? `Would You Rather? ${category ? `[${category.label}]` : ''} — Play Now`
    : pageTitle;
  const pageDescription = `Would you rather ${question.optionA.toLowerCase()} — or — ${question.optionB.toLowerCase()}? Cast your vote and see how others answered.`;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageHead
        title={truncatedTitle}
        description={pageDescription.slice(0, 200)}
        canonicalUrl={`${SITE_URL}/game/${question.id}`}
        imageUrl={`${SITE_URL}/api/card?id=${encodeURIComponent(question.id)}&ratio=1.91x1`}
        twitterCard="summary_large_image"
      />
      <JsonLd data={questionPageJsonLd(question, category)} />
      {/* Leave Category Link */}
      {category && (
        <Pressable
          onPress={handleLeaveCategory}
          hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          style={({ pressed }) => [
            styles.leaveTopButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.leaveActionText}>← All Categories</Text>
        </Pressable>
      )}

      {/* Category + Progress Header */}
      {category && (
        <View style={styles.progressHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${catColor}20` }]}>
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={[styles.categoryLabel, { color: catColor }]}>
              {category.label.toUpperCase()}
            </Text>
          </View>
          {totalInCategory > 0 && (
            <Text style={styles.progressText}>
              QUESTION {currentIdx + 1} OF {totalInCategory}
            </Text>
          )}
        </View>
      )}

      {/* Progress Bar */}
      {totalInCategory > 0 && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: catColor,
                width: `${((currentIdx + (confirmed ? 1 : 0)) / totalInCategory) * 100}%` as any,
              },
            ]}
          />
        </View>
      )}

      {/* Opened from a share link: say what one tap does (#134). */}
      {arrivedViaShare && !confirmed && (
        <Text style={[styles.recipientIntro, { color: catColor }]} testID="recipient-intro">
          {recipientIntro(isKidsCategory, friend)}
        </Text>
      )}

      {/* WYR Label */}
      <Text style={styles.wyrLabel}>WOULD YOU RATHER...</Text>

      {/* Options */}
      <View style={styles.options}>
        <OptionButton
          label="A"
          text={question.optionA}
          selected={selected === 'A'}
          onPress={() => handleOptionPress('A')}
          disabled={confirmed}
          percentage={pctFor('A')}
        />

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <View style={[styles.heartBadge, { borderColor: `${catColor}60`, backgroundColor: `${catColor}15` }]}>
            <Text style={[styles.heartText, { color: catColor }]}>♥</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>

        <OptionButton
          label="B"
          text={question.optionB}
          selected={selected === 'B'}
          onPress={() => handleOptionPress('B')}
          disabled={confirmed}
          percentage={pctFor('B')}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions} onLayout={(e) => { actionsY.current = e.nativeEvent.layout.y; }}>
        {!confirmed && arrivedViaShare ? (
          <Text style={styles.disclosure}>
            Your answer is recorded anonymously to show how others voted.
          </Text>
        ) : !confirmed ? (
          <>
            <Pressable
              onPress={handleConfirm}
              disabled={!selected}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: selected ? catColor : colors.surfaceLight },
                pressed && selected && styles.buttonPressed,
              ]}
            >
              <Text style={[
                styles.confirmButtonText,
                !selected && styles.confirmButtonTextDisabled,
              ]}>
                {selected ? 'CONFIRM PREFERENCE' : 'PICK AN OPTION FIRST'}
              </Text>
            </Pressable>
            <Text style={styles.disclosure}>
              Your answer is recorded anonymously to show how others voted.
            </Text>

            {/* Contextual challenge invite — shown when user picked but hasn't confirmed */}
            {selected && (
              <Pressable
                onPress={() => handleChallengeShare('game_challenge')}
                style={({ pressed }) => [
                  styles.challengeButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.challengeText}>{copyFeedback ?? uiText(isKidsCategory, 'challenge')}</Text>
              </Pressable>
            )}

            {nextQuestion && !nextLocked && (
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.skipText}>Skip →</Text>
              </Pressable>
            )}

            {category && (
              <Pressable
                onPress={handleLeaveCategory}
                hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
                style={({ pressed }) => [
                  styles.leaveBottomButton,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.leaveActionText}>✕ Leave Category</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={[styles.resultBanner, { borderColor: `${catColor}40` }]}>
              <Text style={styles.resultBannerEmoji}>
                {result.kind !== 'percent'
                  ? '✨'
                  : (selected === 'A' ? result.a : result.b) >= 50 ? '🎯' : '🔥'}
              </Text>
              <View style={styles.resultBannerText}>
                <Text style={styles.resultBannerTitle}>
                  {(() => {
                    if (result.kind !== 'percent') return INVITE_TITLE;
                    const mine = selected === 'A' ? result.a : result.b;
                    return mine >= 50 ? 'With the majority!' : 'Uniquely yours!';
                  })()}
                </Text>
                <Text style={styles.resultBannerSub}>
                  {result.kind === 'percent'
                    ? `${selected === 'A' ? result.a : result.b}% of ${result.total.toLocaleString()} players chose Option ${selected}`
                    : INVITE_TEXT}
                </Text>
              </View>
            </View>

            {((outcome && matchLine !== null) || asked) && (
              <View style={[styles.matchCard, { borderColor: `${catColor}60` }]} testID="match-card">
                <Text style={styles.matchTitle}>
                  {uiText(isKidsCategory, outcome === 'matched' ? 'icon_matched' : outcome === 'different' ? 'icon_different' : 'icon_asked')}
                  {headingFor(isKidsCategory, outcome ?? 'asked')}
                </Text>
                {outcome && <Text style={styles.matchLine}>{matchLine}</Text>}
                {friendPick && (
                  <Text style={styles.theyPicked} testID="they-picked">
                    {theyPickedLine(isKidsCategory, friendPick === 'A' ? question.optionA : question.optionB)}
                  </Text>
                )}
                {!arrivedViaShare && (
                <View style={styles.matchButtons}>
                  <Pressable
                    onPress={handleTellThem}
                    accessibilityRole="button"
                    accessibilityLabel={uiText(isKidsCategory, 'tell_them')}
                    style={({ pressed }) => [
                      styles.matchButton,
                      { backgroundColor: catColor },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={styles.matchButtonText}>{copyFeedback ?? uiText(isKidsCategory, 'tell_them')}</Text>
                  </Pressable>
                  {nextQuestion && !nextLocked && (
                    <Pressable
                      onPress={handleAskAnother}
                      accessibilityRole="button"
                      accessibilityLabel={uiText(isKidsCategory, 'ask_another')}
                      style={({ pressed }) => [
                        styles.matchButton,
                        styles.matchButtonOutline,
                        { borderColor: catColor },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.matchButtonText, { color: catColor }]}>{uiText(isKidsCategory, 'ask_another')}</Text>
                    </Pressable>
                  )}
                </View>
                )}
              </View>
            )}

            {/* Recipient next steps (#134): play more, or send one back. */}
            {arrivedViaShare && (
              <View style={styles.recipientActions} testID="recipient-actions">
                <Pressable
                  onPress={handlePlayAnother}
                  accessibilityRole="button"
                  testID="play-another"
                  style={({ pressed }) => [
                    styles.nextButton,
                    { backgroundColor: catColor },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.nextButtonText}>{uiText(isKidsCategory, 'recipient_play_another')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleSendBack}
                  accessibilityRole="button"
                  testID="send-back"
                  style={({ pressed }) => [
                    styles.shareButton,
                    { borderColor: catColor },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.shareButtonText, { color: catColor }]}>
                    {copyFeedback ?? uiText(isKidsCategory, 'recipient_send_back')}
                  </Text>
                </Pressable>
              </View>
            )}

            {!arrivedViaShare && (
            <>
            <Pressable
              onPress={() => handleChallengeShare('game_result')}
              accessibilityRole="button"
              accessibilityLabel="Share this question"
              style={({ pressed }) => [
                styles.shareButton,
                { borderColor: catColor },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.shareButtonText, { color: catColor }]}>
                {copyFeedback ?? uiText(isKidsCategory, 'send_question')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [
                styles.nextButton,
                { backgroundColor: catColor },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.nextButtonText}>
                {isLastInCategory || endsFreeSet ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
              </Text>
            </Pressable>
            </>
            )}

          </>
        )}
      </View>

      {!selected && !confirmed && !arrivedViaShare && (
        <Text style={styles.hint}>Tap an option to make your choice</Text>
      )}
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
      padding: SPACING.lg,
      gap: SPACING.lg,
      flexGrow: 1,
      paddingBottom: SPACING.xxl,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.md,
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.lg,
    },
    backButton: {
      backgroundColor: colors.magenta,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    backButtonText: {
      color: colors.textOnColor,
      fontWeight: FONTS.weights.bold,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
    },
    categoryEmoji: {
      fontSize: 14,
    },
    categoryLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 1,
    },
    progressText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.bold,
      letterSpacing: 1.5,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.surfaceLight,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: RADIUS.full,
    },
    wyrLabel: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
      fontStyle: 'italic',
      fontWeight: FONTS.weights.medium,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    options: {
      gap: SPACING.md,
    },
    orDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    heartBadge: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heartText: {
      fontSize: 18,
    },
    actions: {
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    confirmButton: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        },
      }),
    },
    confirmButtonText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    confirmButtonTextDisabled: {
      color: colors.textMuted,
    },
    challengeButton: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    shareButton: {
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderWidth: 1.5,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    shareButtonText: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    challengeText: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        },
      }),
    },
    skipText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.md,
    },
    matchCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    matchTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    matchLine: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.md,
    },
    matchButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    matchButton: {
      flexGrow: 1,
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      ...Platform.select({ web: { cursor: 'pointer' } }),
    },
    matchButtonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
    },
    matchButtonText: {
      color: '#fff',
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    resultBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
    },
    resultBannerEmoji: {
      fontSize: 32,
    },
    resultBannerText: {
      flex: 1,
      gap: 2,
    },
    resultBannerTitle: {
      color: colors.text,
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.extrabold,
    },
    resultBannerSub: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
    },
    nextButton: {
      borderRadius: RADIUS.full,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        },
      }),
    },
    nextButtonText: {
      color: colors.textOnColor,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.extrabold,
      letterSpacing: 2,
    },
    disclosure: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    hint: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    recipientIntro: {
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
      textAlign: 'center',
    },
    theyPicked: {
      color: colors.textSecondary,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
    },
    recipientActions: {
      gap: SPACING.md,
    },
    leaveActionText: {
      color: colors.textMuted,
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.medium,
      letterSpacing: 0.3,
    },
    leaveTopButton: {
      alignSelf: 'flex-start',
      paddingVertical: SPACING.xs,
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
    leaveBottomButton: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
      ...Platform.select({
        web: { cursor: 'pointer' },
      }),
    },
  });
}
