/**
 * Question bank for the teen category, Real Talk (ages 13–17): friends, school, phones and independence.
 * Light enough to start, real enough to keep going. No romance or dating, no substances, no brands, nothing scary
 * (docs/specs/kids-family-categories.md §2.2, §5.1).
 *
 * Teen ids are `tn-N` and never change. They are not under-13 questions, so they follow the adult analytics rules
 * and `isKidsQuestion` is false for them; the purchase screen keeps the parental gate (`audience: 'teen'`).
 * 8 free starters first, then the paid questions (volume 2).
 *
 * Keep api/_lib/data.js in sync (npm run verify:data checks it).
 */
import type { CategoryId, Question } from './questions';

const tn = (n: number, category: CategoryId, optionA: string, optionB: string, volume?: number): Question => ({
  id: `tn-${n}`,
  category,
  ...(volume ? { volume } : {}),
  optionA,
  optionB,
});
const free = (n: number, optionA: string, optionB: string) => tn(n, 'real-talk', optionA, optionB);
const paid = (n: number, optionA: string, optionB: string) => tn(n, 'real-talk', optionA, optionB, 2);

export const TEEN_QUESTIONS: Question[] = [
  // --- Real Talk (ages 13–17): 8 free starters first, then the paid questions ---
  free(1, 'Lose your phone for a week', 'Lose your weekend plans for a month'),
  free(2, 'Always know when a friend is upset', 'Always know what to say to help'),
  free(3, 'Have one really close friend', 'Have a big group of friends you see sometimes'),
  free(4, 'Be the funniest person in the room', 'Be the most trusted person in the room'),
  free(7, 'Say what you think and risk an argument', 'Stay quiet and keep the peace'),
  free(8, 'Be known for being honest', 'Be known for being easygoing'),
  free(9, 'Be in a group chat that never stops buzzing', 'Have a quiet phone that only rings for important things'),
  free(26, 'Be great at making new friends', 'Be great at keeping old friends'),
  paid(5, 'Have no homework but harder tests', 'Have homework every night but easier tests'),
  paid(6, 'Start school an hour later every day', 'Finish school an hour earlier every day'),
  paid(10, 'Have a phone battery that never runs out but no signal at home', 'Have great signal everywhere but a battery that runs out at 3 pm'),
  paid(11, 'Have a later curfew with a check-in text', 'Have an earlier curfew with no check-ins'),
  paid(12, 'Pick your own bedtime', 'Pick your own phone limits'),
  paid(13, 'Take a break from social media for a month', 'Take a break from video games for a month'),
  paid(14, 'Be really good at a sport', 'Be really good at an instrument'),
  paid(15, 'Be on the team that always wins', 'Be on the team that always has the most fun'),
  paid(16, 'Do a group project with friends who goof off', 'Do a group project with classmates who take it seriously'),
  paid(17, 'Get honest feedback that stings a little', 'Get praise that is not quite true'),
  paid(18, 'Ask for help right away', 'Try to figure it out alone first'),
  paid(19, 'Join a club where you do not know anyone', 'Stick with the activities you already do'),
  paid(20, 'Have a hobby that no one else knows about', 'Have a hobby everyone knows you for'),
  paid(21, 'Be the one who plans the trip', 'Be the one who just shows up'),
  paid(22, 'Spend your savings on one big thing now', 'Save up for something even bigger later'),
  paid(23, 'Work a summer job for your own money', 'Spend the summer on a big project you love'),
  paid(24, 'Rewind time one hour, once a week', 'Skip ahead one hour, once a week'),
  paid(25, 'Have a friend who texts back right away', 'Have a friend who rarely texts but is always there in person'),
  paid(27, 'Change one rule at your school', 'Change one rule at home'),
  paid(28, 'Get a day off where you do whatever you want', 'Get a day off planned by your best friend'),
  paid(29, 'Have a teacher who is strict but fair', 'Have a teacher who is fun but disorganized'),
  paid(30, 'Stand up for a friend in front of a crowd', 'Stand up for a friend in private later'),
];
