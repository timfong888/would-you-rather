import React from 'react';
import { QUESTIONS, CATEGORIES, FAMILY_FRIENDLY } from '@/constants/questions';
import SeoLandingPage from '@/components/SeoLandingPage';

const FAMILY_QUESTIONS = QUESTIONS
  .filter((q) => FAMILY_FRIENDLY.includes(q.category as any))
  .slice(0, 20);

export default function WyrQuestionsForKidsPage() {
  return (
    <SeoLandingPage
      slug="would-you-rather-questions-for-kids"
      pageTitle="50 Would You Rather Questions for Kids — Fun Family Dilemmas"
      pageDescription="Make family time unforgettable with these Would You Rather questions for kids. Perfect for dinner table conversations, road trips, and building real connections. Free to play."
      headline="Would You Rather Questions for Kids"
      subheadline="Turn car rides and dinner tables into unforgettable family conversations. 20 kid-friendly dilemmas — free to play, no download needed."
      questions={FAMILY_QUESTIONS}
      categories={CATEGORIES}
      ctaLabel="Play Free Now →"
    />
  );
}
