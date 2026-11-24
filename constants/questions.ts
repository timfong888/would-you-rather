import { KIDS_QUESTIONS } from './kidsQuestions';
import { TEEN_QUESTIONS } from './teenQuestions';
import { isCategoryAvailable } from './platformFilter';

export type CategoryId =
  | 'high-life'
  | 'moral-compass'
  | 'midnight-secrets'
  | 'social-blunders'
  | 'time-traveler'
  | 'deep-desires'
  | 'career-climber'
  | 'tech-dystopia'
  | 'wildest-dreams'
  | 'tiny-choices'
  | 'make-believe'
  | 'giggle-factory'
  | 'road-trip-rally'
  | 'dinner-table'
  | 'heart-to-heart'
  | 'future-me'
  | 'real-talk'
  | 'holiday-table';

export type CategoryTier = 'free' | 'premium';

/**
 * Who a category is written for (docs/specs/kids-family-categories.md §2.3).
 * - `kids`: youngest age under 13. COPPA applies: no tracking, no persisted IDs (isKidsPath).
 * - `teen`: 13 to 17. Follows the adult analytics rules, but its purchases keep the parental gate.
 * - `adult`: everything else.
 * Every kids rule in the app derives from this, so a new category cannot silently miss the rule.
 */
export type Audience = 'adult' | 'kids' | 'teen';

/** [youngest, oldest] age the questions are written for. */
export type AgeRange = readonly [number, number];

/** First age that is not a "kid" for COPPA purposes. */
export const KIDS_UNDER_AGE = 13;
/** First age treated as an adult. */
export const ADULT_FROM_AGE = 18;
const ADULT_AGES: AgeRange = [ADULT_FROM_AGE, 99];

/** The audience a youngest age implies. Tests check every category's `audience` against this. */
export function audienceForAges(ages: AgeRange): Audience {
  if (ages[0] < KIDS_UNDER_AGE) return 'kids';
  if (ages[0] < ADULT_FROM_AGE) return 'teen';
  return 'adult';
}

export const FREE_TRIAL_COUNT = 3; // First N questions of premium categories are free

/**
 * THE target free count: the first N questions of EVERY category (adult, kids, teen) are free (Tim, 2026-11-24: "each
 * category has N number of free questions, call it 5"). Change it here and only here. The tranche model (lib/tranches.ts)
 * and the catalog already use it; the live screens, the sitemap and the SEO pages keep today's counts (3 or 20 adult, 8
 * kids and teen) until UNIFORM_FREE_COUNT_LIVE is turned on, in the same PR as the paywall change (4c), because turning it
 * on locks 15 questions in each of the four free-tier adult categories and changes the sitemap and the SEO pages.
 */
export const FREE_QUESTIONS_PER_CATEGORY = 5;
/** false in 4a (staging): getFreeQuestionCount keeps returning today's counts. 4c flips it. */
export const UNIFORM_FREE_COUNT_LIVE = false;

export interface CategoryDef {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
  tier: CategoryTier;
  featured?: boolean;
  audience: Audience;
  ages: AgeRange;
}

export interface Question {
  id: string;
  category: CategoryId;
  optionA: string;
  optionB: string;
  /**
   * Content volume. Volume 1 is the original set; volume 2+ are expansion
   * packs. Free categories give away all of volume 1 and gate the rest.
   * Omitted means volume 1.
   */
  volume?: number;
  /**
   * Which SEO landing page this question was written for (constants/seoPages.ts).
   * Used by the Kids & Family bank so each page publishes its own questions.
   */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: CategoryDef[] = [
  {
    id: 'high-life',
    label: 'The High Life',
    emoji: '👑',
    color: '#C9A84C',
    tier: 'premium',
    featured: true,
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'moral-compass',
    label: 'Moral Compass',
    emoji: '🧭',
    color: '#2D6A4F',
    tier: 'free',
    featured: true,
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'midnight-secrets',
    label: 'Midnight Secrets',
    emoji: '🌙',
    color: '#7B2FBE',
    tier: 'premium',
    featured: true,
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'social-blunders',
    label: 'Social Blunders',
    emoji: '😳',
    color: '#1B4FA8',
    tier: 'free',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'time-traveler',
    label: 'Time Traveler',
    emoji: '⏳',
    color: '#C0392B',
    tier: 'premium',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'deep-desires',
    label: 'Deep Desires',
    emoji: '💜',
    color: '#8B2252',
    tier: 'premium',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'career-climber',
    label: 'Career Climber',
    emoji: '🪜',
    color: '#1A7F64',
    tier: 'free',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'tech-dystopia',
    label: 'Tech Dystopia',
    emoji: '🤖',
    color: '#2C4A6E',
    tier: 'free',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  {
    id: 'wildest-dreams',
    label: 'Wildest Dreams',
    emoji: '🌟',
    color: '#4B1C8C',
    tier: 'premium',
    audience: 'adult',
    ages: ADULT_AGES,
  },
  // Kids and teen topic categories (spec §2.2). Each has 8 free questions; the rest are volume 2.
  {
    id: 'tiny-choices',
    label: 'Tiny Choices',
    emoji: '🐣',
    color: '#D9822B',
    tier: 'free',
    audience: 'kids',
    ages: [3, 5],
  },
  {
    id: 'make-believe',
    label: 'Make-Believe',
    emoji: '🏰',
    color: '#7A5BD6',
    tier: 'free',
    audience: 'kids',
    ages: [4, 8],
  },
  {
    id: 'giggle-factory',
    label: 'Giggle Factory',
    emoji: '😂',
    color: '#E0559B',
    tier: 'free',
    audience: 'kids',
    ages: [5, 10],
  },
  {
    id: 'road-trip-rally',
    label: 'Road Trip Rally',
    emoji: '🚗',
    color: '#2E86C1',
    tier: 'free',
    audience: 'kids',
    ages: [4, 12],
  },
  {
    id: 'dinner-table',
    label: 'Dinner Table',
    emoji: '🍽️',
    color: '#3F9B6B',
    tier: 'free',
    audience: 'kids',
    ages: [6, 12],
  },
  {
    id: 'heart-to-heart',
    label: 'Heart to Heart',
    emoji: '💛',
    color: '#D9486C',
    tier: 'free',
    audience: 'kids',
    ages: [7, 12],
  },
  {
    id: 'future-me',
    label: 'Future Me',
    emoji: '🚀',
    color: '#14908F',
    tier: 'free',
    audience: 'kids',
    ages: [11, 17],
  },
  {
    id: 'real-talk',
    label: 'Real Talk',
    emoji: '💬',
    color: '#34495E',
    tier: 'free',
    audience: 'teen',
    ages: [13, 17],
  },
  {
    id: 'holiday-table',
    label: 'Holiday Table',
    emoji: '🎄',
    color: '#B5333E',
    tier: 'free',
    audience: 'kids',
    ages: [4, 12],
  },
];

/** Categories shipped on this platform (iOS v1 leaves two out; see constants/iosV1.ts). */
export const CATEGORIES: CategoryDef[] = ALL_CATEGORIES.filter((c) => isCategoryAvailable(c.id));

// ---------------------------------------------------------------------------
// Quick-play category groups
// ---------------------------------------------------------------------------

// Only the kids-audience categories are safe for children. moral-compass and the other adult banks
// include crime, infidelity and workplace themes, so they are not "family friendly".
// Derived from `audience`, never a list of ids (spec §2.3). Uses the full list, not the platform-filtered
// CATEGORIES: the kids rule must not depend on which categories a platform ships.
export const FAMILY_FRIENDLY: CategoryId[] = ALL_CATEGORIES.filter((c) => c.audience === 'kids').map((c) => c.id);
/** Categories whose purchase screens sit behind the parental gate: kids and teen. */
export const PARENTAL_GATE_CATEGORIES: CategoryId[] = ALL_CATEGORIES.filter((c) => c.audience !== 'adult').map((c) => c.id);

/**
 * Category ids that no longer exist but may still be linked (old shares, bookmarks, search results). They stay
 * kids routes so a stale link never fires analytics before it redirects (docs/specs/kids-family-categories.md §2.3).
 */
export const RETIRED_KIDS_CATEGORY_IDS: readonly string[] = ['kids-family'];

/** The audience of a category id, or undefined for an id that is not a category. */
export function getCategoryAudience(id: string): Audience | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id)?.audience;
}

/** True for a category written for under-13s: the no-tracking rule applies to its routes. */
export function isKidsCategoryId(id: string): boolean {
  return getCategoryAudience(id) === 'kids';
}
export const DARING: CategoryId[] = ['midnight-secrets', 'deep-desires', 'time-traveler', 'wildest-dreams', 'high-life'];

// Questions
// ---------------------------------------------------------------------------

const ALL_QUESTIONS: Question[] = [
  // -------------------------------------------------------------------------
  // The High Life (hl-1 through hl-20)
  // -------------------------------------------------------------------------
  {
    id: 'hl-1',
    category: 'high-life',
    optionA: 'Have a private yacht with a full crew, available to you for life',
    optionB: 'Have a private jet with unlimited fuel, available to you for life',
  },
  {
    id: 'hl-2',
    category: 'high-life',
    optionA: 'Live in a luxury penthouse in the heart of New York City',
    optionB: 'Live in a private beachside villa on your own island in the Maldives',
  },
  {
    id: 'hl-3',
    category: 'high-life',
    optionA: 'Have a personal chef who can cook any cuisine on demand, any time',
    optionB: 'Have a personal trainer who guarantees you peak fitness and health for life',
  },
  {
    id: 'hl-4',
    category: 'high-life',
    optionA: 'Own every car you have ever dreamed of',
    optionB: 'Own a private island retreat designed exactly to your taste',
  },
  {
    id: 'hl-5',
    category: 'high-life',
    optionA: 'Have front-row seats to any event in the world — concerts, sports, premieres — for free, forever',
    optionB: 'Stay at any five-star hotel anywhere in the world for free, forever',
  },
  {
    id: 'hl-6',
    category: 'high-life',
    optionA: 'Always fly private but always travel alone',
    optionB: 'Always fly first class but always surrounded by your favorite people',
  },
  {
    id: 'hl-7',
    category: 'high-life',
    optionA: 'Have a live-in personal stylist who makes you look flawless every single day',
    optionB: 'Have a live-in personal chef who prepares every meal to perfection',
  },
  {
    id: 'hl-8',
    category: 'high-life',
    optionA: 'Win a secret $5 million lottery that no one can ever know about',
    optionB: 'Become publicly celebrated for a talent you are genuinely proud of, earning $80k per year',
  },
  {
    id: 'hl-9',
    category: 'high-life',
    optionA: 'Live rent-free in the most stunning mansion in the world but it is extremely remote',
    optionB: 'Pay market rent for a perfectly located apartment in your favorite city',
  },
  {
    id: 'hl-10',
    category: 'high-life',
    optionA: 'Have a butler who anticipates your every need before you ask',
    optionB: 'Have a personal AI assistant that flawlessly manages every detail of your life',
  },
  {
    id: 'hl-11',
    category: 'high-life',
    optionA: "Dine at the world's top Michelin-starred restaurants for free every night",
    optionB: 'Have a home garden that magically produces any ingredient you desire, year-round',
  },
  {
    id: 'hl-12',
    category: 'high-life',
    optionA: "Have a custom wardrobe designed for you by the world's top fashion houses each season",
    optionB: 'Have a personal jeweler who crafts bespoke jewelry for every occasion in your life',
  },
  {
    id: 'hl-13',
    category: 'high-life',
    optionA: 'Travel everywhere in a chauffeur-driven Rolls Royce',
    optionB: 'Have a private helicopter for all city travel',
  },
  {
    id: 'hl-14',
    category: 'high-life',
    optionA: "Spend a week at the world's most exclusive private resort with every luxury imaginable",
    optionB: 'Spend two weeks in a fully-staffed luxury wilderness lodge completely off the grid',
  },
  {
    id: 'hl-15',
    category: 'high-life',
    optionA: 'Have lifetime VIP access to every major concert, sporting event, and film premiere',
    optionB: 'Have a private home cinema that streams any film or show before it is released publicly',
  },
  {
    id: 'hl-16',
    category: 'high-life',
    optionA: 'Own a working vineyard and winery in Tuscany with a villa on the grounds',
    optionB: 'Own a luxury ski chalet in Aspen with guaranteed powder snow every season',
  },
  {
    id: 'hl-17',
    category: 'high-life',
    optionA: 'Have a personal sommelier who curates and stocks your private wine cellar',
    optionB: 'Have a Michelin-starred chef who meal-preps your weekly meals at home',
  },
  {
    id: 'hl-18',
    category: 'high-life',
    optionA: 'Have a full medical team on call for you and your family, 24 hours a day',
    optionB: 'Have a team of top-tier lawyers on retainer ready to handle any situation for you',
  },
  {
    id: 'hl-19',
    category: 'high-life',
    optionA: 'Take a month-long luxury world cruise on the most opulent ship ever built',
    optionB: 'Spend a month at an exclusive private spa resort perfectly tailored to your preferences',
  },
  {
    id: 'hl-20',
    category: 'high-life',
    optionA: "Own the world's most valuable private watch collection",
    optionB: "Own the world's most impressive private art collection",
  },

  // -------------------------------------------------------------------------
  // Moral Compass (mc-1 through mc-20)
  // -------------------------------------------------------------------------
  {
    id: 'mc-1',
    category: 'moral-compass',
    optionA: 'Tell a brutal truth that you know will hurt someone you love deeply',
    optionB: 'Tell a kind lie that protects their feelings but keeps them in the dark',
  },
  {
    id: 'mc-2',
    category: 'moral-compass',
    optionA: 'Report a close friend to the authorities for a serious crime they committed',
    optionB: 'Keep their secret and live with the guilt for the rest of your life',
  },
  {
    id: 'mc-3',
    category: 'moral-compass',
    optionA: 'Cheat on a high-stakes exam to help your child pass and secure their future',
    optionB: 'Let them fail but use it as a lesson in integrity and hard work',
  },
  {
    id: 'mc-4',
    category: 'moral-compass',
    optionA: "Take credit for a coworker's brilliant idea to save your job",
    optionB: 'Give them full credit and risk losing your own position in the process',
  },
  {
    id: 'mc-5',
    category: 'moral-compass',
    optionA: "Read your teenager's private messages when you genuinely fear for their safety",
    optionB: 'Respect their privacy completely and trust them, even with uncertainty',
  },
  {
    id: 'mc-6',
    category: 'moral-compass',
    optionA: 'Donate your entire life savings to save strangers from a disaster',
    optionB: "Keep it to protect your own family's future security",
  },
  {
    id: 'mc-7',
    category: 'moral-compass',
    optionA: "Tell your best friend that their partner is definitely cheating on them",
    optionB: 'Stay out of it entirely to protect the friendship no matter what',
  },
  {
    id: 'mc-8',
    category: 'moral-compass',
    optionA: 'Return a wallet you found on the street containing $5,000 cash and no ID',
    optionB: 'Keep the money since there is no way to trace its rightful owner',
  },
  {
    id: 'mc-9',
    category: 'moral-compass',
    optionA: 'Tell the complete truth in every situation for a full year, even when it hurts',
    optionB: 'Tell compassionate white lies whenever kindness seems more important than honesty',
  },
  {
    id: 'mc-10',
    category: 'moral-compass',
    optionA: 'Call out a bigoted joke at a family gathering and cause real conflict',
    optionB: 'Stay silent to keep the peace, even though it bothers you deeply',
  },
  {
    id: 'mc-11',
    category: 'moral-compass',
    optionA: "Take a job at a company whose ethics you disagree with that pays three times more",
    optionB: 'Stay at a lower-paying job you love and believe in',
  },
  {
    id: 'mc-12',
    category: 'moral-compass',
    optionA: "Expose a beloved public figure's private hypocrisy that genuinely harms others",
    optionB: 'Let it stay private out of respect for their personal life',
  },
  {
    id: 'mc-13',
    category: 'moral-compass',
    optionA: 'Know every negative thing people say about you behind your back',
    optionB: 'Never know, but feel occasional nagging social anxiety about it',
  },
  {
    id: 'mc-14',
    category: 'moral-compass',
    optionA: 'Forgive someone who clearly regrets hurting you but has never apologized',
    optionB: 'Withhold forgiveness until they acknowledge and own what they did',
  },
  {
    id: 'mc-15',
    category: 'moral-compass',
    optionA: 'Break a minor law if doing so clearly prevents a greater harm',
    optionB: 'Follow the law even when it feels morally wrong in that moment',
  },
  {
    id: 'mc-16',
    category: 'moral-compass',
    optionA: 'Save the one person you love most from a disaster',
    optionB: 'Save five strangers at the cost of being unable to save the person you love',
  },
  {
    id: 'mc-17',
    category: 'moral-compass',
    optionA: 'Live strictly by your absolute moral code even when it leads to worse real-world outcomes',
    optionB: 'Bend your values when doing so would clearly produce better results for everyone',
  },
  {
    id: 'mc-18',
    category: 'moral-compass',
    optionA: 'Be completely honest with your child about a painful truth in your family history',
    optionB: 'Protect their innocence and let them discover it when they are old enough',
  },
  {
    id: 'mc-19',
    category: 'moral-compass',
    optionA: "Intervene and stop a close friend from making a life-altering mistake they are excited about",
    optionB: 'Respect their autonomy and stay quiet even though you know the likely outcome',
  },
  {
    id: 'mc-20',
    category: 'moral-compass',
    optionA: "Write a brutally honest review that could end a struggling artist's career",
    optionB: "Write a generous review that isn't fully truthful to give them a chance",
  },

  // -------------------------------------------------------------------------
  // Midnight Secrets (ms-1 through ms-20)
  // -------------------------------------------------------------------------
  {
    id: 'ms-1',
    category: 'midnight-secrets',
    optionA: 'Know every secret your partner has ever kept from you',
    optionB: "Have complete trust and never know anything they haven't chosen to share",
  },
  {
    id: 'ms-2',
    category: 'midnight-secrets',
    optionA: 'Know the exact date you will die, but not how',
    optionB: 'Know exactly how you will die, but not when',
  },
  {
    id: 'ms-3',
    category: 'midnight-secrets',
    optionA: 'Find out that your closest friend has secretly resented you for years',
    optionB: 'Never know, and keep living the friendship as it appears on the surface',
  },
  {
    id: 'ms-4',
    category: 'midnight-secrets',
    optionA: "Know everyone's unfiltered first impression of you when they meet you",
    optionB: 'Hear exactly what people say about you the moment you leave the room',
  },
  {
    id: 'ms-5',
    category: 'midnight-secrets',
    optionA: 'Discover that a childhood memory you deeply treasure never actually happened',
    optionB: 'Find out a painful memory from your past was actually far worse than you remember',
  },
  {
    id: 'ms-6',
    category: 'midnight-secrets',
    optionA: 'Know the one thing your partner most secretly fears about your relationship',
    optionB: 'Know the one thing they love most about you but have never said out loud',
  },
  {
    id: 'ms-7',
    category: 'midnight-secrets',
    optionA: 'Have your most embarrassing past moments erased from your own memory',
    optionB: "Have those same moments erased from everyone else's memory but not yours",
  },
  {
    id: 'ms-8',
    category: 'midnight-secrets',
    optionA: 'Know the exact moment someone stopped being in love with you',
    optionB: 'Never know, even years after the relationship ends',
  },
  {
    id: 'ms-9',
    category: 'midnight-secrets',
    optionA: 'Read the completely uncensored thoughts your family members have about your life choices',
    optionB: 'Know the secret dreams they hold for your future that they would never tell you',
  },
  {
    id: 'ms-10',
    category: 'midnight-secrets',
    optionA: 'Learn a hard truth that would shatter an important relationship in your life',
    optionB: 'Live in blissful ignorance of that truth forever',
  },
  {
    id: 'ms-11',
    category: 'midnight-secrets',
    optionA: 'Know every mistake you are going to make in the next year, before you make them',
    optionB: 'Know all the wonderful things coming your way in the next year, but not the hard ones',
  },
  {
    id: 'ms-12',
    category: 'midnight-secrets',
    optionA: 'Have your deepest secret revealed to three people you genuinely trust',
    optionB: 'Have a minor but embarrassing secret broadcast to the entire world',
  },
  {
    id: 'ms-13',
    category: 'midnight-secrets',
    optionA: 'Know in advance which of your friends would truly show up for you in a real crisis',
    optionB: 'Not know until the actual crisis, and discover it in the moment',
  },
  {
    id: 'ms-14',
    category: 'midnight-secrets',
    optionA: 'Discover the one invisible thing that is holding you back from your biggest dream',
    optionB: 'Discover the one small action you could take tomorrow that would change everything',
  },
  {
    id: 'ms-15',
    category: 'midnight-secrets',
    optionA: 'Know with full clarity exactly how and when the world as we know it ends',
    optionB: 'Remain completely oblivious and live out your days in happiness',
  },
  {
    id: 'ms-16',
    category: 'midnight-secrets',
    optionA: 'Hear the honest truth about why your last significant relationship ended',
    optionB: 'Keep the story you have told yourself, even if it is not quite true',
  },
  {
    id: 'ms-17',
    category: 'midnight-secrets',
    optionA: 'Be able to hear every lie being spoken to you the moment it is said, but never confront it',
    optionB: 'Be unable to detect lies at all and simply trust people at face value',
  },
  {
    id: 'ms-18',
    category: 'midnight-secrets',
    optionA: 'Know exactly what your future self thinks of the choices you are making right now',
    optionB: 'Receive a letter from your younger self about what truly mattered most',
  },
  {
    id: 'ms-19',
    category: 'midnight-secrets',
    optionA: 'Discover that your entire personality was shaped by one overlooked moment in childhood',
    optionB: 'Believe your character is entirely your own creation and always has been',
  },
  {
    id: 'ms-20',
    category: 'midnight-secrets',
    optionA: 'Know exactly how many people in your life genuinely love you versus merely tolerate you',
    optionB: 'Assume everyone genuinely cares and live happily inside that belief',
  },

  // -------------------------------------------------------------------------
  // Social Blunders (sb-1 through sb-20)
  // -------------------------------------------------------------------------
  {
    id: 'sb-1',
    category: 'social-blunders',
    optionA: 'Loudly trip and fall in front of your crush in front of an audience',
    optionB: 'Accidentally call your teacher "Mom" in front of your entire class',
  },
  {
    id: 'sb-2',
    category: 'social-blunders',
    optionA: 'Send a brutally honest message about your boss directly to your boss by mistake',
    optionB: 'Accidentally send a very personal message to your entire contact list',
  },
  {
    id: 'sb-3',
    category: 'social-blunders',
    optionA: 'Show up to a formal black-tie event in casual clothes when everyone else is dressed up',
    optionB: 'Show up in a full tuxedo or gown to a casual backyard hangout',
  },
  {
    id: 'sb-4',
    category: 'social-blunders',
    optionA: 'Burst into uncontrollable laughter at a funeral',
    optionB: 'Fall completely asleep and snore at your own birthday party',
  },
  {
    id: 'sb-5',
    category: 'social-blunders',
    optionA: 'Be caught talking to yourself in an animated, fully committed way in a public place',
    optionB: 'Be spotted ugly-crying at a movie in a packed, sold-out theater',
  },
  {
    id: 'sb-6',
    category: 'social-blunders',
    optionA: "Enthusiastically wave back at someone who wasn't actually waving at you, in front of a crowd",
    optionB: 'Call someone the wrong name multiple times in a very important conversation',
  },
  {
    id: 'sb-7',
    category: 'social-blunders',
    optionA: 'Have your phone go off at full volume with your most embarrassing ringtone during a job interview',
    optionB: "Accidentally like a three-year-old photo while deep-stalking someone's social media",
  },
  {
    id: 'sb-8',
    category: 'social-blunders',
    optionA: 'Loudly mispronounce a simple common word during a big presentation',
    optionB: "Completely forget someone's name the instant after being introduced at a very important event",
  },
  {
    id: 'sb-9',
    category: 'social-blunders',
    optionA: 'Be caught in a small lie by the exact person you told it about',
    optionB: 'Have to publicly confess an embarrassing truth about yourself in a large group setting',
  },
  {
    id: 'sb-10',
    category: 'social-blunders',
    optionA: 'Spill an entire drink on someone you just met at an important party',
    optionB: "Accidentally sit in someone's reserved seat and refuse to move out of sheer confusion",
  },
  {
    id: 'sb-11',
    category: 'social-blunders',
    optionA: 'Realize mid-conversation that you have had spinach in your teeth all day and no one said anything',
    optionB: 'Discover at the end of a full day of meetings that your fly has been unzipped the whole time',
  },
  {
    id: 'sb-12',
    category: 'social-blunders',
    optionA: 'Accidentally hit "reply all" on a company-wide email with something deeply personal in it',
    optionB: 'Have your private calendar projected on the main screen during a company all-hands meeting',
  },
  {
    id: 'sb-13',
    category: 'social-blunders',
    optionA: 'Be the only person in a group who laughs loudly at a joke no one else found funny',
    optionB: 'Be the only person who does not laugh when everyone around you is in hysterics',
  },
  {
    id: 'sb-14',
    category: 'social-blunders',
    optionA: 'Go in for a handshake when someone clearly wanted a hug, leaving both of you awkward',
    optionB: 'Go in for a hug when someone clearly offered a handshake, in front of a group',
  },
  {
    id: 'sb-15',
    category: 'social-blunders',
    optionA: 'Walk confidently into the wrong meeting room and begin talking before you realize it',
    optionB: 'Wave enthusiastically at a stranger for nearly a minute before realizing they are not your friend',
  },
  {
    id: 'sb-16',
    category: 'social-blunders',
    optionA: 'Start telling a joke to a group and completely forget the punchline mid-delivery',
    optionB: 'Tell a story and realize halfway through that it is deeply embarrassing for someone else in the room',
  },
  {
    id: 'sb-17',
    category: 'social-blunders',
    optionA: 'Walk straight into a full glass door in a busy, crowded office lobby',
    optionB: 'Catch your bag on a store display and pull the whole thing crashing down',
  },
  {
    id: 'sb-18',
    category: 'social-blunders',
    optionA: "Call your new partner by your ex's name in front of both of your families",
    optionB: 'Confidently use the wrong pronoun for someone during introductions at a large gathering',
  },
  {
    id: 'sb-19',
    category: 'social-blunders',
    optionA: 'Answer your phone and start a full conversation before realizing the call never connected and everyone heard',
    optionB: 'Have a stranger overhear your entire side of a very private phone conversation in public',
  },
  {
    id: 'sb-20',
    category: 'social-blunders',
    optionA: 'Be caught dramatically lip-syncing and completely wrong to a song when someone walks in',
    optionB: 'Be found rehearsing a speech alone with full gestures and facial expressions, unaware anyone was watching',
  },

  // -------------------------------------------------------------------------
  // Time Traveler (tt-1 through tt-20)
  // -------------------------------------------------------------------------
  {
    id: 'tt-1',
    category: 'time-traveler',
    optionA: 'Go back and fix your single biggest life regret, but lose one cherished memory as the price',
    optionB: 'Keep the memory exactly as it is and live with the regret forever',
  },
  {
    id: 'tt-2',
    category: 'time-traveler',
    optionA: 'Live in Ancient Rome at the height of its power for one full year',
    optionB: 'Live in Ancient Egypt during the era of the great pyramid builders',
  },
  {
    id: 'tt-3',
    category: 'time-traveler',
    optionA: 'Travel 100 years into the future, experiencing it fully, but never return to the present',
    optionB: 'Go back 100 years into the past and get permanently stuck in that era',
  },
  {
    id: 'tt-4',
    category: 'time-traveler',
    optionA: 'Spend a week in the future seeing what your own life becomes',
    optionB: 'Spend a week in the past seeing what your parents were truly like at your current age',
  },
  {
    id: 'tt-5',
    category: 'time-traveler',
    optionA: 'Re-live any single day of your life exactly as it was, with all the same feelings',
    optionB: 'Change the outcome of one past conversation you have always deeply regretted',
  },
  {
    id: 'tt-6',
    category: 'time-traveler',
    optionA: 'Travel back to give your teenage self one piece of advice you wish you had heard',
    optionB: 'Travel forward to receive one piece of advice from your 80-year-old self',
  },
  {
    id: 'tt-7',
    category: 'time-traveler',
    optionA: 'Fully live through one decade from history that you get to choose',
    optionB: 'Have one uninterrupted hour of conversation with any historical figure ever',
  },
  {
    id: 'tt-8',
    category: 'time-traveler',
    optionA: 'Use your time travel ability to prevent a personal tragedy in your own life',
    optionB: 'Use it to prevent a historical disaster that killed thousands of people',
  },
  {
    id: 'tt-9',
    category: 'time-traveler',
    optionA: 'Witness the first moon landing as a member of the Apollo crew',
    optionB: 'Witness the signing of the most significant peace treaty in human history as it happened',
  },
  {
    id: 'tt-10',
    category: 'time-traveler',
    optionA: 'Know the exact moment in history when things began going irreversibly wrong for humanity',
    optionB: 'Know the single change that would have made human history go right',
  },
  {
    id: 'tt-11',
    category: 'time-traveler',
    optionA: 'Travel to any future civilization but only as a silent observer who cannot interact',
    optionB: 'Travel to any past civilization and live as a full participant in that society',
  },
  {
    id: 'tt-12',
    category: 'time-traveler',
    optionA: 'Live your entire life in reverse — starting old and growing younger — but with full memory intact',
    optionB: 'Live your life forward as normal but with one chance for a complete do-over at any point',
  },
  {
    id: 'tt-13',
    category: 'time-traveler',
    optionA: 'Be present at the founding moment of a major world religion',
    optionB: 'Be present at the most magnificent peak of an ancient empire in all its glory',
  },
  {
    id: 'tt-14',
    category: 'time-traveler',
    optionA: 'Know the exact date of every major disaster for the next 100 years but be unable to stop them',
    optionB: 'Not know any disasters in advance but have the power to stop one of your choosing',
  },
  {
    id: 'tt-15',
    category: 'time-traveler',
    optionA: 'Spend a year in the medieval period with all your current knowledge fully intact',
    optionB: 'Spend a year 200 years in the future as a purely silent observer',
  },
  {
    id: 'tt-16',
    category: 'time-traveler',
    optionA: 'Go back and change the outcome of one important relationship from your past',
    optionB: 'Fast-forward through the hardest years of your current life with no memory of them',
  },
  {
    id: 'tt-17',
    category: 'time-traveler',
    optionA: "Be transported to a pivotal moment in your family's history and witness it firsthand",
    optionB: 'Be transported to the single most pivotal moment in all of world history',
  },
  {
    id: 'tt-18',
    category: 'time-traveler',
    optionA: 'Have the ability to pause time for 24 hours, once per year',
    optionB: 'Have the ability to rewind time exactly one week, once per year',
  },
  {
    id: 'tt-19',
    category: 'time-traveler',
    optionA: 'See a detailed documentary from the future about how your life turns out',
    optionB: 'See a detailed documentary from the future about how the world turns out',
  },
  {
    id: 'tt-20',
    category: 'time-traveler',
    optionA: 'Travel back to witness the single greatest artistic performance in all of human history',
    optionB: 'Travel forward to witness the greatest scientific breakthrough humanity ever achieves',
  },

  // -------------------------------------------------------------------------
  // Deep Desires (dd-1 through dd-20)
  // -------------------------------------------------------------------------
  {
    id: 'dd-1',
    category: 'deep-desires',
    optionA: 'Be globally famous and admired by millions, but profoundly lonely in your private life',
    optionB: 'Be completely unknown to the world but deeply loved by a small circle of people',
  },
  {
    id: 'dd-2',
    category: 'deep-desires',
    optionA: 'Achieve your single biggest life goal, but lose your best friend in the process',
    optionB: 'Keep that friendship intact forever, but never reach that goal',
  },
  {
    id: 'dd-3',
    category: 'deep-desires',
    optionA: 'Find your true soulmate but have to permanently give up your dream career',
    optionB: 'Live out your dream career fully but never find that once-in-a-lifetime love',
  },
  {
    id: 'dd-4',
    category: 'deep-desires',
    optionA: 'Be financially secure for life doing work that bores you completely',
    optionB: 'Be financially unstable doing the work you feel you were born to do',
  },
  {
    id: 'dd-5',
    category: 'deep-desires',
    optionA: 'Know your exact life purpose from this moment forward with perfect clarity',
    optionB: 'Spend your life searching for it, experiencing a richer and more varied journey',
  },
  {
    id: 'dd-6',
    category: 'deep-desires',
    optionA: 'Have a life full of extraordinary adventures and experiences but very little stability',
    optionB: 'Have a life of deep stability, security, and peace but limited adventure',
  },
  {
    id: 'dd-7',
    category: 'deep-desires',
    optionA: 'Be remembered long after you are gone for something extraordinary you created',
    optionB: 'Be deeply and profoundly missed by those who knew you for the kind of person you were',
  },
  {
    id: 'dd-8',
    category: 'deep-desires',
    optionA: 'Love someone completely and unconditionally who can only love you back seventy percent',
    optionB: 'Be loved completely and unconditionally by someone you can only give seventy percent to',
  },
  {
    id: 'dd-9',
    category: 'deep-desires',
    optionA: 'Spend your remaining years pursuing one grand passion that fulfills you completely',
    optionB: 'Divide your time across many things that bring steady but smaller joy',
  },
  {
    id: 'dd-10',
    category: 'deep-desires',
    optionA: 'Have perfect clarity about who you truly are as a person',
    optionB: 'Have perfect clarity about what you truly want from your life',
  },
  {
    id: 'dd-11',
    category: 'deep-desires',
    optionA: 'Fall into the most transformative love of your life knowing with certainty it will not last',
    optionB: 'Stay in a comfortable, stable love that never quite reaches those extraordinary heights',
  },
  {
    id: 'dd-12',
    category: 'deep-desires',
    optionA: 'Achieve everything you have ever dreamed of by age 40 and spend the rest in quiet fulfillment',
    optionB: 'Spend your whole life in devoted pursuit of your dreams, never quite arriving but always reaching',
  },
  {
    id: 'dd-13',
    category: 'deep-desires',
    optionA: 'Live a life that makes your parents deeply proud, even if it is not fully your own',
    optionB: 'Live a life that is entirely and authentically yours, even if it disappoints those who love you',
  },
  {
    id: 'dd-14',
    category: 'deep-desires',
    optionA: 'Have everything you want but never experience the hunger of wanting something deeply',
    optionB: 'Deeply long for things and only occasionally experience something truly extraordinary',
  },
  {
    id: 'dd-15',
    category: 'deep-desires',
    optionA: 'Have every form of career success imaginable but struggle deeply in love',
    optionB: 'Have a lasting, profound love but never quite find professional meaning or fulfillment',
  },
  {
    id: 'dd-16',
    category: 'deep-desires',
    optionA: 'Know before you die that you made the right choices in your life',
    optionB: 'Wonder your entire life but die feeling completely at peace regardless',
  },
  {
    id: 'dd-17',
    category: 'deep-desires',
    optionA: 'Be told exactly what your greatest strengths are by the people who know you best',
    optionB: 'Be told the single thing holding you back from your full potential',
  },
  {
    id: 'dd-18',
    category: 'deep-desires',
    optionA: 'Have one perfect day completely in flow — effortlessly doing what you love — on infinite repeat',
    optionB: 'Have every day be slightly imperfect but always marked by genuine growth',
  },
  {
    id: 'dd-19',
    category: 'deep-desires',
    optionA: 'Make one bold life choice right now with no safety net and no guaranteed outcome',
    optionB: 'Make a safe, careful choice that guarantees a decent but unremarkable life',
  },
  {
    id: 'dd-20',
    category: 'deep-desires',
    optionA: 'Be the person who inspired countless others to reach their dreams, even if you never reached yours',
    optionB: 'Be the person who reached their own dreams fully but inspired no one else in the process',
  },

  // -------------------------------------------------------------------------
  // Career Climber (cc-1 through cc-20)
  // -------------------------------------------------------------------------
  {
    id: 'cc-1',
    category: 'career-climber',
    optionA: 'Be the most respected professional in your entire industry but earn the lowest salary',
    optionB: 'Be the highest-paid person in your field but widely regarded as the least respected',
  },
  {
    id: 'cc-2',
    category: 'career-climber',
    optionA: 'Have your absolute dream job with a brutal three-hour daily commute each way',
    optionB: 'Have a perfectly fine but uninspiring job that is literally five minutes from home',
  },
  {
    id: 'cc-3',
    category: 'career-climber',
    optionA: 'Work eighty hours a week doing work you are genuinely and passionately in love with',
    optionB: 'Work thirty-five hours a week doing work you feel completely indifferent about',
  },
  {
    id: 'cc-4',
    category: 'career-climber',
    optionA: 'Have a boss who pushes you hard past your limits and drives real results',
    optionB: 'Have a completely hands-off boss who leaves you alone but offers no challenge or growth',
  },
  {
    id: 'cc-5',
    category: 'career-climber',
    optionA: 'Be promoted into a management role you never wanted but that pays significantly more',
    optionB: 'Stay in the role you love with no promotion path and no growth opportunity',
  },
  {
    id: 'cc-6',
    category: 'career-climber',
    optionA: 'Take a massive career risk with a forty percent chance of a life-changing breakthrough',
    optionB: 'Play it safe with a strategy that guarantees steady, reliable, but modest progress',
  },
  {
    id: 'cc-7',
    category: 'career-climber',
    optionA: 'Work at a startup where you have huge individual impact but face constant instability',
    optionB: 'Work at a large corporation where you are stable and comfortable but largely anonymous',
  },
  {
    id: 'cc-8',
    category: 'career-climber',
    optionA: 'Give the best and most polished presentation of your entire career and receive zero recognition',
    optionB: 'Give a mediocre and forgettable presentation and receive a major promotion for it',
  },
  {
    id: 'cc-9',
    category: 'career-climber',
    optionA: 'Have a brilliant mentor who is brutally direct and sometimes harsh in their feedback',
    optionB: 'Be left entirely to your own devices to figure everything out without guidance',
  },
  {
    id: 'cc-10',
    category: 'career-climber',
    optionA: 'Work fully remotely forever but be consistently passed over for promotions and visibility',
    optionB: 'Be in the office every day but be the first person considered for every opportunity',
  },
  {
    id: 'cc-11',
    category: 'career-climber',
    optionA: 'Be told by your entire team that you are the best leader they have ever had',
    optionB: "Be told by your company's executives that you are the top performer they have ever seen",
  },
  {
    id: 'cc-12',
    category: 'career-climber',
    optionA: 'Land your absolute dream job but have to relocate to a city you genuinely dislike',
    optionB: 'Stay in the city you love working in a job that is just perfectly okay',
  },
  {
    id: 'cc-13',
    category: 'career-climber',
    optionA: 'Start your own business knowing that seventy percent of startups ultimately fail',
    optionB: 'Climb the corporate ladder knowing you will retire comfortably but never build anything of your own',
  },
  {
    id: 'cc-14',
    category: 'career-climber',
    optionA: 'Be seen by everyone as creative, exciting, and visionary but unfortunately unreliable',
    optionB: 'Be seen as consistent, dependable, and trustworthy but never recognized as innovative',
  },
  {
    id: 'cc-15',
    category: 'career-climber',
    optionA: 'Get a massive and meaningful raise but work directly under a genuinely terrible manager',
    optionB: 'Turn down the raise and continue working with a team you absolutely love',
  },
  {
    id: 'cc-16',
    category: 'career-climber',
    optionA: 'Have complete autonomy in your role but receive no feedback on how you are actually doing',
    optionB: 'Get highly specific and useful feedback constantly but be micromanaged at every turn',
  },
  {
    id: 'cc-17',
    category: 'career-climber',
    optionA: 'Spend the next five years building a career you are deeply uncertain about',
    optionB: 'Spend five years exploring and experimenting to find what truly lights you up professionally',
  },
  {
    id: 'cc-18',
    category: 'career-climber',
    optionA: 'Have a career that makes you feel genuinely powerful and influential',
    optionB: 'Have a career that makes you feel deeply purposeful and meaningfully connected to others',
  },
  {
    id: 'cc-19',
    category: 'career-climber',
    optionA: 'Always be the smartest and most knowledgeable person in every room and meeting',
    optionB: 'Always be the person everyone turns to for leadership, calm, and genuine trust',
  },
  {
    id: 'cc-20',
    category: 'career-climber',
    optionA: 'Retire at age 45 with enough money to live comfortably but nothing left to build or pursue',
    optionB: 'Work until 65, spending those years building something truly significant and lasting',
  },

  // -------------------------------------------------------------------------
  // Tech Dystopia (td-1 through td-20)
  // -------------------------------------------------------------------------
  {
    id: 'td-1',
    category: 'tech-dystopia',
    optionA: 'Live in a world where AI handles all creative work so humans never need to create again',
    optionB: 'Live in a world where AI handles all physical labor so humans never work physically again',
  },
  {
    id: 'td-2',
    category: 'tech-dystopia',
    optionA: 'Have a brain chip that makes you ten times smarter but gives up some privacy in your thoughts',
    optionB: 'Live without any chip at all and remain at your entirely natural level of intelligence',
  },
  {
    id: 'td-3',
    category: 'tech-dystopia',
    optionA: 'Have every conversation you have recorded and stored forever by a central AI',
    optionB: 'Have no record of any conversation ever, risking the loss of every meaningful exchange',
  },
  {
    id: 'td-4',
    category: 'tech-dystopia',
    optionA: 'Live in a world where your emotional mood is continuously monitored by your employer',
    optionB: 'Live in a world where your physical health data is monitored and shared without full consent',
  },
  {
    id: 'td-5',
    category: 'tech-dystopia',
    optionA: 'Have a personal AI that knows you better than you know yourself and acts on it',
    optionB: 'Have complete privacy from all AI but navigate every important decision entirely alone',
  },
  {
    id: 'td-6',
    category: 'tech-dystopia',
    optionA: 'Never be tracked digitally again but permanently lose access to all technology conveniences',
    optionB: 'Be fully and permanently trackable but gain access to extraordinarily powerful AI tools',
  },
  {
    id: 'td-7',
    category: 'tech-dystopia',
    optionA: "Live in a society where everyone's public reputation score affects every aspect of daily life",
    optionB: 'Live in a society where reputation is entirely private but corruption is completely rampant',
  },
  {
    id: 'td-8',
    category: 'tech-dystopia',
    optionA: 'Have an AI compose every email, message, and letter on your behalf, perfectly',
    optionB: 'Write every single word of your own communications with absolutely no AI assistance ever',
  },
  {
    id: 'td-9',
    category: 'tech-dystopia',
    optionA: 'Live in a world where social media platforms no longer exist in any form',
    optionB: 'Live in a world where social media exists but shows only completely unfiltered, unedited reality',
  },
  {
    id: 'td-10',
    category: 'tech-dystopia',
    optionA: 'Have a neural link giving you instant access to all of human knowledge, but lose all quiet thought',
    optionB: 'Have a fully private and disconnected mind but struggle to access and retain information quickly',
  },
  {
    id: 'td-11',
    category: 'tech-dystopia',
    optionA: 'Have an AI therapist with complete access to every detail of your mental and emotional life',
    optionB: 'Have no mental health support system of any kind but retain total emotional privacy',
  },
  {
    id: 'td-12',
    category: 'tech-dystopia',
    optionA: 'Have technology that accurately predicts your health problems ten years before they emerge',
    optionB: 'Have total medical privacy with no predictive health technology in your life at all',
  },
  {
    id: 'td-13',
    category: 'tech-dystopia',
    optionA: 'Live in a city where self-driving everything makes transport effortless but no one manually drives',
    optionB: 'Live in a city where humans still drive everything but traffic is completely chaotic',
  },
  {
    id: 'td-14',
    category: 'tech-dystopia',
    optionA: 'Have technology that detects lies in real time during any conversation you have',
    optionB: 'Live in a world where everyone else has this lie-detection technology except you',
  },
  {
    id: 'td-15',
    category: 'tech-dystopia',
    optionA: 'Use AI to fully simulate any life experience — travel, relationships, adventure — from home',
    optionB: 'Experience everything firsthand, in real life, slower and with genuine risk and cost',
  },
  {
    id: 'td-16',
    category: 'tech-dystopia',
    optionA: 'Live in a world where all memories can be digitally backed up and perfectly restored',
    optionB: "Live in a world where memories are entirely your own — precious, imperfect, and irreplaceable",
  },
  {
    id: 'td-17',
    category: 'tech-dystopia',
    optionA: 'Have your entire social media presence managed by an AI version of you that represents you perfectly',
    optionB: 'Run all your own accounts completely authentically, messily, and entirely by yourself',
  },
  {
    id: 'td-18',
    category: 'tech-dystopia',
    optionA: 'Live in a world where deep fakes are illegal but total surveillance is the trade-off',
    optionB: 'Live in a world where deep fakes run rampant but surveillance does not exist at all',
  },
  {
    id: 'td-19',
    category: 'tech-dystopia',
    optionA: 'Have a robot that handles every chore and errand inside and around your home',
    optionB: 'Have a full-time human assistant who manages your professional and social schedule',
  },
  {
    id: 'td-20',
    category: 'tech-dystopia',
    optionA: 'Live in the last city on Earth that refuses all smart technology and AI integration',
    optionB: "Live in the world's most advanced smart city where everything is continuously AI-optimized",
  },

  // -------------------------------------------------------------------------
  // Wildest Dreams (wd-1 through wd-20)
  // -------------------------------------------------------------------------
  {
    id: 'wd-1',
    category: 'wildest-dreams',
    optionA: 'Be able to fly freely through the air but only at a casual walking pace',
    optionB: 'Run at a hundred miles per hour but only ever on the ground',
  },
  {
    id: 'wd-2',
    category: 'wildest-dreams',
    optionA: 'Speak to animals fluently but they only ever want to complain about their problems',
    optionB: 'Read human minds perfectly but only ever pick up mundane and trivial thoughts',
  },
  {
    id: 'wd-3',
    category: 'wildest-dreams',
    optionA: 'Pause time completely for ten seconds, once every day',
    optionB: 'Rewind time by exactly one minute, once every week',
  },
  {
    id: 'wd-4',
    category: 'wildest-dreams',
    optionA: 'Breathe underwater naturally and permanently without any equipment',
    optionB: 'Survive in the vacuum of outer space without any suit or equipment',
  },
  {
    id: 'wd-5',
    category: 'wildest-dreams',
    optionA: 'Have the power to completely heal any illness in one person, once per year',
    optionB: 'Have the power to prevent any accident from happening, once per month',
  },
  {
    id: 'wd-6',
    category: 'wildest-dreams',
    optionA: 'Be completely invisible for one full hour per day, but you never know exactly when it will happen',
    optionB: 'Choose exactly when to become invisible, but only for five minutes each week',
  },
  {
    id: 'wd-7',
    category: 'wildest-dreams',
    optionA: 'Have an incredibly powerful superpower that only works when absolutely no one is watching',
    optionB: 'Have a more modest superpower that works anytime, but everyone around you can always see it',
  },
  {
    id: 'wd-8',
    category: 'wildest-dreams',
    optionA: 'Be able to fluently speak and understand every language currently spoken on Earth, but forget your own',
    optionB: 'Speak only your native language but have the ability to understand every language ever spoken in history',
  },
  {
    id: 'wd-9',
    category: 'wildest-dreams',
    optionA: 'Instantly copy any skill you observe someone perform once, but you can never practice or improve it',
    optionB: 'Achieve full mastery of one single skill of your choice in an instant, but only ever that one',
  },
  {
    id: 'wd-10',
    category: 'wildest-dreams',
    optionA: 'Live in a world where every person chooses one minor superpower of their own',
    optionB: 'Live in a world where superpowers are randomly and unpredictably distributed at birth',
  },
  {
    id: 'wd-11',
    category: 'wildest-dreams',
    optionA: 'Teleport instantly to anywhere you have already visited, but never somewhere you have not been',
    optionB: 'Take one single teleport anywhere on Earth you choose, including places you have never seen',
  },
  {
    id: 'wd-12',
    category: 'wildest-dreams',
    optionA: 'Own a fire-breathing dragon that obeys your every command but everyone in the world can see it',
    optionB: 'Have an invisible dragon only you can perceive, who gives you brilliant advice on anything',
  },
  {
    id: 'wd-13',
    category: 'wildest-dreams',
    optionA: 'Have the ability to make any plant grow to full size instantly with a touch',
    optionB: 'Have the ability to make any broken or malfunctioning machine work perfectly just by touching it',
  },
  {
    id: 'wd-14',
    category: 'wildest-dreams',
    optionA: 'Live permanently on the moon in a magical, fully comfortable habitat with a breathtaking view of Earth',
    optionB: 'Live in a stunning, fully magical underwater palace deep in the most beautiful ocean on Earth',
  },
  {
    id: 'wd-15',
    category: 'wildest-dreams',
    optionA: 'Have functional gills that let you live freely as both a land creature and a sea creature',
    optionB: 'Have wings that let you glide gracefully through the air, requiring a running start and unable to hover',
  },
  {
    id: 'wd-16',
    category: 'wildest-dreams',
    optionA: 'Stop all time except for yourself for exactly one minute, once every day',
    optionB: 'Slow all time to half speed for five full minutes, once every day',
  },
  {
    id: 'wd-17',
    category: 'wildest-dreams',
    optionA: 'Step inside any book you choose and live in its fictional world for twenty-four hours',
    optionB: 'Step inside any film you choose and live in its world for twenty-four hours',
  },
  {
    id: 'wd-18',
    category: 'wildest-dreams',
    optionA: 'Shrink to the size of a mouse at will whenever you like, but need a full hour to return to normal',
    optionB: 'Grow to thirty feet tall for ten explosive minutes, exactly once per day',
  },
  {
    id: 'wd-19',
    category: 'wildest-dreams',
    optionA: 'Conjure any food you have ever tasted before, instantly and in unlimited quantity',
    optionB: 'Conjure any drink that exists in the universe, including flavors you have never encountered',
  },
  {
    id: 'wd-20',
    category: 'wildest-dreams',
    optionA: 'Live in a parallel universe identical to ours except for one single major difference you get to pick',
    optionB: 'Stay in your current world but permanently change one thing about it of your choosing',
  },

  // =========================================================================
  // EXPANSION PACKS (volume 2)
  // Paid continuation for the free categories. Free categories give away all
  // of volume 1; everything with volume >= 2 is unlocked with the category.
  // =========================================================================

  // -------------------------------------------------------------------------
  // Moral Compass — Expansion Pack (mc-21 through mc-40)
  // -------------------------------------------------------------------------
  { id: 'mc-21', category: 'moral-compass', volume: 2, optionA: 'Find twenty dollars on the playground and hand it to a teacher', optionB: 'Keep it, since nobody saw you pick it up' },
  { id: 'mc-22', category: 'moral-compass', volume: 2, optionA: 'Admit you broke the window and lose your allowance for a month', optionB: 'Stay quiet and let everyone think the wind did it' },
  { id: 'mc-23', category: 'moral-compass', volume: 2, optionA: 'Share your lunch with a classmate who forgot theirs and go a little hungry', optionB: 'Eat your whole lunch because you need the energy for practice' },
  { id: 'mc-24', category: 'moral-compass', volume: 2, optionA: 'Tell your friend their drawing needs work when they ask for honest feedback', optionB: 'Say it is perfect so they feel great today' },
  { id: 'mc-25', category: 'moral-compass', volume: 2, optionA: 'Give the last seat on the bus to an older person and stand the whole ride', optionB: 'Keep the seat because you got there first' },
  { id: 'mc-26', category: 'moral-compass', volume: 2, optionA: 'Win a game because the referee missed your foul and say nothing', optionB: 'Tell the referee and risk losing the game' },
  { id: 'mc-27', category: 'moral-compass', volume: 2, optionA: 'Stick up for the new kid being teased, even if your friends get annoyed', optionB: 'Stay quiet so you do not lose your friends' },
  { id: 'mc-28', category: 'moral-compass', volume: 2, optionA: 'Return the extra toy the store accidentally put in your bag', optionB: 'Keep it since it was the store\'s mistake' },
  { id: 'mc-29', category: 'moral-compass', volume: 2, optionA: 'Tell your parents your sibling broke the rule they asked you about', optionB: 'Cover for your sibling and take the blame yourself' },
  { id: 'mc-30', category: 'moral-compass', volume: 2, optionA: 'Give your birthday money to an animal shelter', optionB: 'Save it for the game you have wanted all year' },
  { id: 'mc-31', category: 'moral-compass', volume: 2, optionA: 'Let a teammate who tried hard take the final shot even if they might miss', optionB: 'Take the shot yourself because you are more likely to make it' },
  { id: 'mc-32', category: 'moral-compass', volume: 2, optionA: 'Tell the truth and get a friend in trouble', optionB: 'Tell a small lie and keep your friend out of trouble' },
  { id: 'mc-33', category: 'moral-compass', volume: 2, optionA: 'Clean up a mess you did not make because the room needs to be ready', optionB: 'Leave it and let the person who made it deal with it' },
  { id: 'mc-34', category: 'moral-compass', volume: 2, optionA: 'Get a trophy you did not really earn', optionB: 'Get no trophy but know you played your very best' },
  { id: 'mc-35', category: 'moral-compass', volume: 2, optionA: 'Invite the kid nobody invites to your party', optionB: 'Only invite your closest friends so everyone is comfortable' },
  { id: 'mc-36', category: 'moral-compass', volume: 2, optionA: 'Say sorry first even when you think the fight was not your fault', optionB: 'Wait for the other person to apologize first' },
  { id: 'mc-37', category: 'moral-compass', volume: 2, optionA: 'Use your one wish to fix something for your family', optionB: 'Use your one wish to fix something for the whole world' },
  { id: 'mc-38', category: 'moral-compass', volume: 2, optionA: 'Spend your Saturday helping a neighbor move', optionB: 'Spend your Saturday doing exactly what you want' },
  { id: 'mc-39', category: 'moral-compass', volume: 2, optionA: 'Tell a grown-up about a friend who is being hurt, even if they begged you not to', optionB: 'Keep the promise you made to your friend' },
  { id: 'mc-40', category: 'moral-compass', volume: 2, optionA: 'Forgive someone who never says sorry', optionB: 'Stay upset until they finally apologize' },

  // -------------------------------------------------------------------------
  // Social Blunders — Expansion Pack (sb-21 through sb-40)
  // -------------------------------------------------------------------------
  { id: 'sb-21', category: 'social-blunders', volume: 2, optionA: 'Wave enthusiastically at someone who was waving at the person behind you', optionB: 'Call your teacher "Mom" in front of the whole class' },
  { id: 'sb-22', category: 'social-blunders', volume: 2, optionA: 'Have your stomach growl loudly during the quietest moment of a test', optionB: 'Sneeze so hard your glasses fly across the room' },
  { id: 'sb-23', category: 'social-blunders', volume: 2, optionA: 'Trip and fall on stage at the school play', optionB: 'Forget every one of your lines but stay standing' },
  { id: 'sb-24', category: 'social-blunders', volume: 2, optionA: 'Walk around all day with spinach in your teeth and nobody tells you', optionB: 'Walk around all day with your shirt on inside out' },
  { id: 'sb-25', category: 'social-blunders', volume: 2, optionA: 'Laugh so hard that milk comes out of your nose at a fancy dinner', optionB: 'Hiccup nonstop through your best friend\'s birthday speech' },
  { id: 'sb-26', category: 'social-blunders', volume: 2, optionA: 'Accidentally send a silly selfie to the whole class group chat', optionB: 'Accidentally like a photo from five years ago on someone\'s profile' },
  { id: 'sb-27', category: 'social-blunders', volume: 2, optionA: 'Sing happy birthday loudly to the wrong person', optionB: 'Give a hug to someone who was only reaching for a handshake' },
  { id: 'sb-28', category: 'social-blunders', volume: 2, optionA: 'Show up to a costume party in full costume when nobody else dressed up', optionB: 'Show up in normal clothes when everyone else is in costume' },
  { id: 'sb-29', category: 'social-blunders', volume: 2, optionA: 'Have your voice crack in the middle of your class presentation', optionB: 'Have your phone go off with an embarrassing ringtone during it' },
  { id: 'sb-30', category: 'social-blunders', volume: 2, optionA: 'Get caught talking to yourself in the mirror', optionB: 'Get caught dancing alone in the kitchen' },
  { id: 'sb-31', category: 'social-blunders', volume: 2, optionA: 'Forget the name of someone you have met five times', optionB: 'Call someone by the wrong name all year long' },
  { id: 'sb-32', category: 'social-blunders', volume: 2, optionA: 'Push on a door that clearly says PULL while people watch', optionB: 'Say "you too" when the waiter tells you to enjoy your meal' },
  { id: 'sb-33', category: 'social-blunders', volume: 2, optionA: 'Spill a whole tray of food in the busy cafeteria', optionB: 'Sit down at the wrong lunch table and only notice after a full minute' },
  { id: 'sb-34', category: 'social-blunders', volume: 2, optionA: 'Have a sneeze turn into a very loud honk', optionB: 'Have a yawn turn into a very loud roar' },
  { id: 'sb-35', category: 'social-blunders', volume: 2, optionA: 'Tell a joke and get complete silence', optionB: 'Laugh loudly at a joke before realizing it was not a joke' },
  { id: 'sb-36', category: 'social-blunders', volume: 2, optionA: 'Wear two different shoes to school and notice at lunch', optionB: 'Wear pajama pants to school and notice at the front door' },
  { id: 'sb-37', category: 'social-blunders', volume: 2, optionA: 'Get stuck in a hug that goes on way too long', optionB: 'Get stuck in a handshake neither of you knows how to end' },
  { id: 'sb-38', category: 'social-blunders', volume: 2, optionA: 'Reply "haha" to serious news because you did not read it properly', optionB: 'Send a message meant for your friend to your grandparent' },
  { id: 'sb-39', category: 'social-blunders', volume: 2, optionA: 'Burp loudly during a moment of silence', optionB: 'Fall asleep and snore during a movie with friends' },
  { id: 'sb-40', category: 'social-blunders', volume: 2, optionA: 'Realize you have been pronouncing a common word wrong your whole life', optionB: 'Realize you have been singing the wrong lyrics to your favorite song for years' },

  // -------------------------------------------------------------------------
  // Career Climber — Expansion Pack (cc-21 through cc-40)
  // -------------------------------------------------------------------------
  { id: 'cc-21', category: 'career-climber', volume: 2, optionA: 'Be the captain of a team that usually loses', optionB: 'Be a regular player on a team that always wins' },
  { id: 'cc-22', category: 'career-climber', volume: 2, optionA: 'Be a famous chef who works every night and weekend', optionB: 'Be an unknown chef with every evening free for family' },
  { id: 'cc-23', category: 'career-climber', volume: 2, optionA: 'Have a job where you travel to a new country every month', optionB: 'Have a job where you work from home and never commute' },
  { id: 'cc-24', category: 'career-climber', volume: 2, optionA: 'Be the smartest person in the room but nobody listens to you', optionB: 'Be average but everyone listens to what you say' },
  { id: 'cc-25', category: 'career-climber', volume: 2, optionA: 'Invent something that helps millions but nobody knows your name', optionB: 'Be famous for something small that fades in a year' },
  { id: 'cc-26', category: 'career-climber', volume: 2, optionA: 'Be a veterinarian who sometimes gets bitten', optionB: 'Be a zookeeper who sometimes gets sprayed' },
  { id: 'cc-27', category: 'career-climber', volume: 2, optionA: 'Be the boss and make every hard decision', optionB: 'Be the trusted expert whose advice the boss always follows' },
  { id: 'cc-28', category: 'career-climber', volume: 2, optionA: 'Work four long days a week with three-day weekends', optionB: 'Work five short days a week with every afternoon free' },
  { id: 'cc-29', category: 'career-climber', volume: 2, optionA: 'Be an astronaut who spends a year away from everyone you love', optionB: 'Be the mission controller who stays home but never leaves Earth' },
  { id: 'cc-30', category: 'career-climber', volume: 2, optionA: 'Start your own small business that might fail', optionB: 'Take a safe job at a big company that will never be exciting' },
  { id: 'cc-31', category: 'career-climber', volume: 2, optionA: 'Be a teacher who changes one student\'s life every year', optionB: 'Be an author whose book is read by a million people once' },
  { id: 'cc-32', category: 'career-climber', volume: 2, optionA: 'Give a speech to a thousand people', optionB: 'Write a report that a thousand people must read' },
  { id: 'cc-33', category: 'career-climber', volume: 2, optionA: 'Be the best at a job you find boring', optionB: 'Be merely okay at a job you absolutely love' },
  { id: 'cc-34', category: 'career-climber', volume: 2, optionA: 'Work with your best friend and risk the friendship', optionB: 'Work with strangers and keep the friendship separate' },
  { id: 'cc-35', category: 'career-climber', volume: 2, optionA: 'Be a professional athlete for ten years then retire', optionB: 'Be a doctor for forty years' },
  { id: 'cc-36', category: 'career-climber', volume: 2, optionA: 'Get a promotion but have to move far from home', optionB: 'Stay in your current role near everyone you know' },
  { id: 'cc-37', category: 'career-climber', volume: 2, optionA: 'Be the first person to do something new and risky', optionB: 'Be the person who makes something good even better' },
  { id: 'cc-38', category: 'career-climber', volume: 2, optionA: 'Build video games for a living but never have time to play them', optionB: 'Play video games every evening but build spreadsheets all day' },
  { id: 'cc-39', category: 'career-climber', volume: 2, optionA: 'Be a scientist who discovers something in fifty years', optionB: 'Be a firefighter who saves someone this year' },
  { id: 'cc-40', category: 'career-climber', volume: 2, optionA: 'Have a mentor who is tough but makes you great', optionB: 'Have a mentor who is kind but lets you coast' },

  // -------------------------------------------------------------------------
  // Tech Dystopia — Expansion Pack (td-21 through td-40)
  // -------------------------------------------------------------------------
  { id: 'td-21', category: 'tech-dystopia', volume: 2, optionA: 'Have a robot that does all your homework but you learn nothing', optionB: 'Have a robot that quizzes you nonstop until you know everything' },
  { id: 'td-22', category: 'tech-dystopia', volume: 2, optionA: 'Live in a house that knows exactly what you want before you ask', optionB: 'Live in a house that cannot hear or see you at all' },
  { id: 'td-23', category: 'tech-dystopia', volume: 2, optionA: 'Give up video games forever', optionB: 'Give up watching videos forever' },
  { id: 'td-24', category: 'tech-dystopia', volume: 2, optionA: 'Have a phone that only works for one hour a day', optionB: 'Have a phone that works all day but everyone can see your screen' },
  { id: 'td-25', category: 'tech-dystopia', volume: 2, optionA: 'Ride in a self-driving car that is never wrong but never fun', optionB: 'Drive yourself and sometimes get lost' },
  { id: 'td-26', category: 'tech-dystopia', volume: 2, optionA: 'Have a robot pet that never gets sick but never really loves you', optionB: 'Have a real pet that needs care and sometimes gets sick' },
  { id: 'td-27', category: 'tech-dystopia', volume: 2, optionA: 'Learn any skill instantly by downloading it to your brain', optionB: 'Learn every skill the slow way but remember it forever' },
  { id: 'td-28', category: 'tech-dystopia', volume: 2, optionA: 'Have a watch that tells you exactly how long every task will take', optionB: 'Have a watch that tells you exactly how someone feels about you' },
  { id: 'td-29', category: 'tech-dystopia', volume: 2, optionA: 'Go to school in virtual reality from your bedroom', optionB: 'Go to a real school with no screens allowed anywhere' },
  { id: 'td-30', category: 'tech-dystopia', volume: 2, optionA: 'Have a drone deliver anything you want in ten minutes', optionB: 'Have a 3D printer that makes anything you want in an hour' },
  { id: 'td-31', category: 'tech-dystopia', volume: 2, optionA: 'Have a translator in your ear so you understand every language', optionB: 'Have a device that lets you talk to animals' },
  { id: 'td-32', category: 'tech-dystopia', volume: 2, optionA: 'Have a robot friend who agrees with everything you say', optionB: 'Have a robot friend who argues with you about everything' },
  { id: 'td-33', category: 'tech-dystopia', volume: 2, optionA: 'Have a map that shows where everyone you know is right now', optionB: 'Have a map that shows where everyone you know will be tomorrow' },
  { id: 'td-34', category: 'tech-dystopia', volume: 2, optionA: 'Never have to charge any device ever again', optionB: 'Never have to wait for anything to load ever again' },
  { id: 'td-35', category: 'tech-dystopia', volume: 2, optionA: 'Have a camera that records your whole life so you never forget anything', optionB: 'Have no camera at all and keep only the memories in your head' },
  { id: 'td-36', category: 'tech-dystopia', volume: 2, optionA: 'Have a robot that cooks perfect meals but picks what you eat', optionB: 'Cook your own meals and eat whatever you want' },
  { id: 'td-37', category: 'tech-dystopia', volume: 2, optionA: 'Have an app that tells you when anyone is lying', optionB: 'Have an app that tells you when anyone is sad' },
  { id: 'td-38', category: 'tech-dystopia', volume: 2, optionA: 'Live in a city with no cars, only flying buses', optionB: 'Live in a city with no buses, only tiny personal pods' },
  { id: 'td-39', category: 'tech-dystopia', volume: 2, optionA: 'Have a hologram of your favorite musician perform in your living room', optionB: 'Have a robot that can play any instrument teach you to play' },
  { id: 'td-40', category: 'tech-dystopia', volume: 2, optionA: 'Have a screen-free day every single week', optionB: 'Have unlimited screen time but only on Sundays' },

  // Kids categories (kf-*, under 13) and the teen category (tn-*): see constants/kidsQuestions.ts and teenQuestions.ts
  ...KIDS_QUESTIONS,
  ...TEEN_QUESTIONS,
];

export const QUESTIONS: Question[] = ALL_QUESTIONS.filter((q) => isCategoryAvailable(q.category));

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function getCategoryById(id: CategoryId): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryQuestions(categoryId: CategoryId): Question[] {
  return QUESTIONS.filter((q) => q.category === categoryId);
}

// ---------------------------------------------------------------------------
// Access / gating helpers
//
// Every screen must decide "is this question playable?" the same way, so the
// rule lives here and nowhere else:
//   - premium category: first FREE_TRIAL_COUNT questions are free
//   - free category:    all of volume 1 is free; expansion volumes are paid
//   - unlocking a category (purchase or owner access) opens everything in it
// ---------------------------------------------------------------------------

export function getQuestionVolume(q: Question): number {
  return q.volume ?? 1;
}

/** Number of questions at the start of the category that are free to play. */
export function targetFreeQuestionCount(category: CategoryDef): number {
  return Math.min(FREE_QUESTIONS_PER_CATEGORY, getCategoryQuestions(category.id).length);
}

/** What the live screens, the sitemap and the SEO pages use. Today's counts until UNIFORM_FREE_COUNT_LIVE (4c). */
export function getFreeQuestionCount(category: CategoryDef): number {
  if (UNIFORM_FREE_COUNT_LIVE) return targetFreeQuestionCount(category);
  const questions = getCategoryQuestions(category.id);
  if (category.tier === 'premium') {
    return Math.min(FREE_TRIAL_COUNT, questions.length);
  }
  return questions.filter((q) => getQuestionVolume(q) === 1).length;
}

/** Number of questions in the category that sit behind the unlock. */
export function getLockedQuestionCount(category: CategoryDef): number {
  return getCategoryQuestions(category.id).length - getFreeQuestionCount(category);
}

/** True when the category has anything to sell (premium, or has an expansion pack). */
export function hasPaidContent(category: CategoryDef): boolean {
  return getLockedQuestionCount(category) > 0;
}

/** Expansion-pack questions (volume >= 2) for a category. */
export function getExpansionQuestions(categoryId: CategoryId): Question[] {
  return getCategoryQuestions(categoryId).filter((q) => getQuestionVolume(q) >= 2);
}

/**
 * Whether the question at `questionIndex` (position within the category's
 * ordered question list) is locked for a user who has / has not unlocked it.
 */
export function isQuestionLocked(
  category: CategoryDef,
  questionIndex: number,
  categoryUnlocked: boolean,
): boolean {
  if (categoryUnlocked) return false;
  return questionIndex >= getFreeQuestionCount(category);
}

/** Questions the user can play right now, in category order. */
export function getAccessibleQuestions(category: CategoryDef, categoryUnlocked: boolean): Question[] {
  const questions = getCategoryQuestions(category.id);
  if (categoryUnlocked) return questions;
  return questions.slice(0, getFreeQuestionCount(category));
}

/** @deprecated use isQuestionLocked — kept for callers on older branches. */
export function isPremiumGated(category: CategoryDef, questionIndex: number): boolean {
  return isQuestionLocked(category, questionIndex, false);
}
