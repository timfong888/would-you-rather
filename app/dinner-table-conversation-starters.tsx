import React from 'react';
import { QUESTIONS, CATEGORIES } from '@/constants/questions';
import SeoLandingPage from '@/components/SeoLandingPage';

const DINNER_CATEGORIES = ['moral-compass', 'social-blunders', 'career-climber'];

const DINNER_QUESTIONS = QUESTIONS
  .filter((q) => DINNER_CATEGORIES.includes(q.category))
  .slice(0, 20);

export default function DinnerTableConversationStartersPage() {
  return (
    <SeoLandingPage
      slug="dinner-table-conversation-starters"
      pageTitle="Dinner Table Conversation Starters — Would You Rather Dilemmas"
      pageDescription="Break the silence and spark real conversations at dinner with these Would You Rather dilemmas. Perfect for families, friends, and anyone tired of phones at the table."
      headline="Dinner Table Conversation Starters"
      subheadline="Put the phones down. These Would You Rather dilemmas spark real debates and bring people together — no awkward silences required."
      questions={DINNER_QUESTIONS}
      categories={CATEGORIES}
      ctaLabel="Start the Conversation →"
    />
  );
}
