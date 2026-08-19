import React from 'react';
import { QUESTIONS, CATEGORIES } from '@/constants/questions';
import SeoLandingPage from '@/components/SeoLandingPage';

const COUPLES_CATEGORIES = ['midnight-secrets', 'deep-desires', 'moral-compass'];

const COUPLES_QUESTIONS = QUESTIONS
  .filter((q) => COUPLES_CATEGORIES.includes(q.category))
  .slice(0, 20);

export default function QuestionsForCouplesPage() {
  return (
    <SeoLandingPage
      slug="questions-for-couples"
      pageTitle="Would You Rather Questions for Couples — Deepen Your Connection"
      pageDescription="These Would You Rather questions for couples reveal how you really think — and show your partner a side of you they haven't seen. Perfect for date nights and long conversations."
      headline="Would You Rather for Couples"
      subheadline="You think you know each other. These questions will surprise you. Share a question, compare answers, and see where you actually stand."
      questions={COUPLES_QUESTIONS}
      categories={CATEGORIES}
      ctaLabel="Play Together →"
    />
  );
}
