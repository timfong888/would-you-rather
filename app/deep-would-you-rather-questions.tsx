import React from 'react';
import { QUESTIONS, CATEGORIES, DARING, FREE_TRIAL_COUNT } from '@/constants/questions';
import SeoLandingPage from '@/components/SeoLandingPage';

const deepCounts: Record<string, number> = {};
const DEEP_QUESTIONS = QUESTIONS.filter((q) => {
  if (!DARING.includes(q.category)) return false;
  deepCounts[q.category] = (deepCounts[q.category] ?? 0) + 1;
  return deepCounts[q.category] <= FREE_TRIAL_COUNT;
});

export default function DeepWouldYouRatherQuestionsPage() {
  return (
    <SeoLandingPage
      slug="deep-would-you-rather-questions"
      pageTitle="Deep Would You Rather Questions — Thought-Provoking Dilemmas"
      pageDescription="Go beyond small talk with these deep Would You Rather questions. Explore values, desires, and the things people rarely say out loud. Ideal for late nights and real conversations."
      headline="Deep Would You Rather Questions"
      subheadline="The questions you don't normally ask. Reveal what people actually value — and what they secretly fear. Best played after midnight."
      questions={DEEP_QUESTIONS}
      categories={CATEGORIES}
      ctaLabel="Go Deep →"
    />
  );
}
