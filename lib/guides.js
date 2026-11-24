// Pillar guides (/guides/<slug>), issue #211, docs/specs/seo-question-pages.md. Plain JS (with guides.d.ts) so the app and the
// build scripts share it. Question ids are explicit and frozen; every id must have a read-only question page (SEO_QUESTION_PAGES in lib/seoBatch.js: batch one or batch two) so the
// guide can link to its read-only question page. Guides for parents are kids pages: kids rule, kids destinations only.

export const GUIDES = [
  {
    slug: 'car-and-road-trip-games-for-families',
    kids: true,
    updated: '2026-11-24',
    keyword: 'games to play in the car',
    title: 'Games to Play in the Car: 20 Would You Rather Questions for Kids',
    h1: 'Games to Play in the Car for Families',
    description:
      'Games to play in the car with kids: 20 would-you-rather questions for road trips and school runs, no screens, no props, and tips for every age.',
    intro: [
      'A long drive goes better when everyone has something to do together. Would-you-rather is one of the easiest car games there is: no props, no screen, no rules to explain. Someone reads a question, everyone picks a side, and the fun is in asking why.',
      'These 20 questions are picked for the back seat. They are short enough to say once and answer fast, and they work for a mix of ages, from a four-year-old who picks the funnier option to a ten-year-old who wants to argue about it.',
    ],
    sections: [
      {
        heading: 'Road trip questions',
        text: 'Start here. These are about the trip itself, so every child has an opinion.',
        ids: ['kf-196', 'kf-197', 'kf-195', 'kf-202', 'kf-199', 'kf-203', 'kf-205', 'kf-213'],
      },
      {
        heading: 'Silly questions for when everyone needs a laugh',
        text: 'When the back seat gets restless, a silly question usually fixes it.',
        ids: ['kf-26', 'kf-27', 'kf-42', 'kf-28'],
      },
      {
        heading: 'Imagination questions',
        text: 'These start the longer conversations: ask "what would you do first?" after each answer.',
        ids: ['kf-1', 'kf-216', 'kf-13', 'kf-17'],
      },
      {
        heading: 'Easy questions for little ones',
        text: 'Two clear choices a young child can answer without help.',
        ids: ['kf-46', 'kf-47', 'kf-58', 'kf-56'],
      },
    ],
    tips: [
      'Take turns being the reader, so the driver does not have to do it all.',
      'Always ask "why?" after the answer. The reason is the game.',
      'For ages 3 to 5, read the question slowly and hold up one hand for each choice.',
      'For ages 8 and up, let them add a third option or make up a new question for you.',
      'Keep a "pass" rule: nobody has to answer a question they do not like.',
    ],
    landing: ['road-trip-would-you-rather-questions', 'would-you-rather-questions-for-family', 'funny-would-you-rather-questions-for-kids'],
  },
  {
    slug: 'funny-would-you-rather-questions-for-kids-and-families',
    kids: true,
    updated: '2026-11-24',
    keyword: 'funny would you rather questions',
    title: 'Funny Would You Rather Questions for Kids and Families, by Age',
    h1: 'Funny Would You Rather Questions for Kids and Families, by Age',
    description:
      'Funny would you rather questions for kids, sorted by age: 24 silly choices for ages 3 to 10, with tips for reading them aloud and keeping everyone laughing.',
    intro: [
      'The funniest would-you-rather questions are the ones a child can picture right away: a pool of pudding, a pet dragon the size of a cat, a sneeze that makes confetti. This page sorts 24 of them by age so you can start at the right level and move up.',
      'Read one aloud, let everyone pick a side, then ask the question that makes it funny: "why?" The reasons are usually funnier than the choices.',
    ],
    sections: [
      {
        heading: 'Ages 3 to 5: easy choices',
        text: 'Two clear options, one idea each. Hold up a hand for each choice if reading aloud.',
        ids: ['kf-46', 'kf-52', 'kf-56', 'kf-57', 'kf-47', 'kf-59', 'kf-61', 'kf-58'],
      },
      {
        heading: 'Ages 4 to 8: pretend and imagine',
        text: 'Magic, castles and pets that do not exist. Ask "what would you do first?" after each answer.',
        ids: ['kf-1', 'kf-2', 'kf-3', 'kf-17', 'kf-20', 'kf-13', 'kf-216', 'kf-24'],
      },
      {
        heading: 'Ages 5 to 10: silly and a little gross',
        text: 'The choices that get the loudest groans and the biggest laughs.',
        ids: ['kf-26', 'kf-27', 'kf-42', 'kf-28', 'kf-91'],
      },
      {
        heading: 'Ages 5 to 10: quick picks everyone has an opinion on',
        text: 'Easy to answer in a second, and sure to start an argument about why.',
        ids: ['kf-101', 'kf-102', 'kf-118'],
      },
    ],
    tips: [
      'Start one level below your child\'s age. An easy win keeps the game fun.',
      'Let your child read a question to you. Reading the funny ones out loud is half the fun.',
      'Give the silliest answer yourself and defend it with a straight face.',
      'If the room gets loud, ask for the quietest, most serious reason for the choice.',
      'Keep the "pass" rule: nobody has to answer a question they do not like.',
    ],
    landing: ['funny-would-you-rather-questions-for-kids', 'would-you-rather-questions-for-kindergarten', 'gross-would-you-rather-questions'],
  },
  {
    slug: 'conversation-starters-for-families',
    kids: true,
    updated: '2026-11-24',
    keyword: 'conversation starters for families',
    title: 'Conversation Starters for Families: 20 Dinner Table Questions',
    h1: 'Conversation Starters for Families at the Dinner Table',
    description:
      'Conversation starters for families: 20 would-you-rather questions that get kids talking about their day, their friends and what matters to them.',
    intro: [
      'Most family dinners start with "how was school?" and end with "fine." A would-you-rather question gives a child something easy to answer and a reason to say more. The question is the way in; the reason behind the answer is the conversation.',
      'These 20 questions are grouped by the kind of talk they start: a family night in, what matters to your child, and the holidays.',
    ],
    sections: [
      {
        heading: 'Questions for an ordinary dinner',
        text: 'Light, fast and about family life. Good for every night of the week.',
        ids: ['kf-156', 'kf-67', 'kf-154', 'kf-169', 'kf-179', 'kf-192', 'kf-185', 'kf-164'],
      },
      {
        heading: 'Questions about friends, kindness and feelings',
        text: 'These start the slower conversations. Let there be a pause after the answer and see what comes next.',
        ids: ['kf-188', 'kf-178', 'kf-189', 'kf-244', 'kf-246', 'kf-251', 'kf-258', 'kf-259'],
      },
      {
        heading: 'Holiday table questions',
        text: 'For Thanksgiving, Christmas and any big family meal.',
        ids: ['kf-132', 'kf-128', 'kf-123', 'kf-140'],
      },
    ],
    tips: [
      'Pick one question per dinner and let everyone answer, grown-ups included.',
      'Answer honestly yourself. Children copy the way you talk about your own choices.',
      'Ask "what made you pick that one?" and then listen without correcting.',
      'Keep it short: one question and its follow-up is enough for a busy night.',
      'Let a different person choose the question each night.',
    ],
    landing: ['dinner-table-conversation-starters', 'would-you-rather-questions-for-family', 'thanksgiving-would-you-rather-questions'],
  },
];

export function guideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug);
}

export const guideQuestionIds = (guide) => guide.sections.flatMap((s) => s.ids);
