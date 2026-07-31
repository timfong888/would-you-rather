export type Category = 'fun' | 'food' | 'adventure' | 'life' | 'tech' | 'social';

export interface Question {
  id: string;
  category: Category;
  optionA: string;
  optionB: string;
  votesA: number;
  votesB: number;
}

export const CATEGORIES: { id: Category; label: string; emoji: string; color: string }[] = [
  { id: 'fun', label: 'Fun & Games', emoji: '🎮', color: '#6C63FF' },
  { id: 'food', label: 'Food & Drink', emoji: '🍕', color: '#FF6B6B' },
  { id: 'adventure', label: 'Adventure', emoji: '🌍', color: '#4ECDC4' },
  { id: 'life', label: 'Life Choices', emoji: '🌱', color: '#45B7D1' },
  { id: 'tech', label: 'Tech & Future', emoji: '🤖', color: '#96CEB4' },
  { id: 'social', label: 'Social', emoji: '👥', color: '#FFEAA7' },
];

export const QUESTIONS: Question[] = [
  // Fun & Games
  {
    id: 'fun-1',
    category: 'fun',
    optionA: 'Always win at board games but lose at video games',
    optionB: 'Always win at video games but lose at board games',
    votesA: 342,
    votesB: 518,
  },
  {
    id: 'fun-2',
    category: 'fun',
    optionA: 'Be a famous athlete',
    optionB: 'Be a famous musician',
    votesA: 621,
    votesB: 489,
  },
  {
    id: 'fun-3',
    category: 'fun',
    optionA: 'Have unlimited video game lives',
    optionB: 'Have cheat codes for real life',
    votesA: 287,
    votesB: 743,
  },

  // Food & Drink
  {
    id: 'food-1',
    category: 'food',
    optionA: 'Only eat pizza for the rest of your life',
    optionB: 'Only eat tacos for the rest of your life',
    votesA: 543,
    votesB: 677,
  },
  {
    id: 'food-2',
    category: 'food',
    optionA: 'Have the ability to eat anything without gaining weight',
    optionB: 'Always feel full and energized after eating just a salad',
    votesA: 891,
    votesB: 209,
  },
  {
    id: 'food-3',
    category: 'food',
    optionA: 'Be a world-class chef',
    optionB: 'Have access to every restaurant for free forever',
    votesA: 412,
    votesB: 688,
  },

  // Adventure
  {
    id: 'adv-1',
    category: 'adventure',
    optionA: 'Explore the deep ocean',
    optionB: 'Explore outer space',
    votesA: 398,
    votesB: 702,
  },
  {
    id: 'adv-2',
    category: 'adventure',
    optionA: 'Have the ability to fly',
    optionB: 'Have the ability to breathe underwater',
    votesA: 774,
    votesB: 326,
  },
  {
    id: 'adv-3',
    category: 'adventure',
    optionA: 'Travel to any country for free',
    optionB: 'Travel through time once',
    votesA: 445,
    votesB: 655,
  },

  // Life Choices
  {
    id: 'life-1',
    category: 'life',
    optionA: 'Know when you are going to die',
    optionB: 'Know how you are going to die',
    votesA: 234,
    votesB: 866,
  },
  {
    id: 'life-2',
    category: 'life',
    optionA: 'Be incredibly smart',
    optionB: 'Be incredibly lucky',
    votesA: 567,
    votesB: 533,
  },
  {
    id: 'life-3',
    category: 'life',
    optionA: 'Never have to sleep',
    optionB: 'Never have to work',
    votesA: 423,
    votesB: 677,
  },

  // Tech & Future
  {
    id: 'tech-1',
    category: 'tech',
    optionA: 'Have a robot do all your chores',
    optionB: 'Have AI solve all your work problems',
    votesA: 389,
    votesB: 711,
  },
  {
    id: 'tech-2',
    category: 'tech',
    optionA: 'Live in a world with perfect AI assistants',
    optionB: 'Live in a world where humans are 10x smarter',
    votesA: 598,
    votesB: 502,
  },
  {
    id: 'tech-3',
    category: 'tech',
    optionA: 'Upload your consciousness to the cloud',
    optionB: 'Live forever in a physical but enhanced body',
    votesA: 312,
    votesB: 788,
  },

  // Social
  {
    id: 'social-1',
    category: 'social',
    optionA: 'Know what everyone thinks about you',
    optionB: 'Have no one ever judge you',
    votesA: 267,
    votesB: 833,
  },
  {
    id: 'social-2',
    category: 'social',
    optionA: 'Have 1,000 close friends',
    optionB: 'Have 1 perfect best friend',
    votesA: 189,
    votesB: 911,
  },
  {
    id: 'social-3',
    category: 'social',
    optionA: 'Be famous but misunderstood',
    optionB: 'Be unknown but deeply appreciated by a few',
    votesA: 445,
    votesB: 655,
  },
];

export function getQuestionsByCategory(category: Category): Question[] {
  return QUESTIONS.filter((q) => q.category === category);
}

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
