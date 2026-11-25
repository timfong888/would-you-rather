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
  {
    slug: 'dad-and-kid-activities',
    kids: true,
    updated: '2026-11-24',
    keyword: 'dad and kid activities',
    title: 'Dad and Kid Activities: 20 Would You Rather Questions',
    h1: 'Dad and Kid Activities: Would You Rather Questions to Play Together',
    description:
      'Dad and kid activities that need no gear and no plan: 20 would-you-rather questions for the car, the kitchen and the walk home, and how to ask them.',
    intro: [
      'Many kids talk more when they are next to you doing something than when they are sitting across from you being asked questions. A would-you-rather question fits that: it is quick, it has no wrong answer, and it works in the car, on a walk or while you cook.',
      'These 20 questions are grouped by when they work. Pick one, say yours first, and listen to the reason your child gives. That reason is the point.',
    ],
    sections: [
      {
        heading: 'Questions for the car or a walk',
        text: 'Side-by-side time. Nobody has to look at anybody.',
        ids: ['kf-195', 'kf-205', 'kf-199', 'kf-239'],
      },
      {
        heading: 'Questions for doing something together',
        text: 'Ask while you cook, build or play outside, then do the thing they picked.',
        ids: ['kf-157', 'kf-168', 'kf-184', 'kf-175'],
      },
      {
        heading: 'Silly questions for dad jokes and bad voices',
        text: 'Do the voice. Make the face. Let them beat you at being silly.',
        ids: ['kf-26', 'kf-32', 'kf-39', 'kf-45'],
      },
      {
        heading: 'Questions that open a real conversation',
        text: 'Use these when things are calm. Say your own answer honestly, then ask what made them pick theirs.',
        ids: ['kf-188', 'kf-189', 'kf-251', 'kf-259', 'kf-178'],
      },
      {
        heading: 'Questions about who they might become',
        text: 'Easy ways to hear what your child is curious about, without asking "what do you want to be?"',
        ids: ['kf-68', 'kf-83', 'kf-81'],
      },
    ],
    tips: [
      'Answer first sometimes, and let your answer be a little silly or a little honest.',
      'After their answer, ask "why?" once and then wait. Do not fix or correct it.',
      'Do what they picked when you can: the pancakes, the fort, the walk.',
      'Short is fine. One question on the way to school counts.',
      'Let them ask you one back. Kids learn to talk by being asked, and by getting to ask.',
    ],
    landing: ['would-you-rather-questions-for-family', 'funny-would-you-rather-questions-for-kids', 'dinner-table-conversation-starters'],
  },
  {
    slug: 'family-game-night-ideas',
    kids: true,
    updated: '2026-11-24',
    keyword: 'family game night ideas',
    title: 'Family Game Night Ideas: 20 Would You Rather Questions',
    h1: 'Family Game Night Ideas: Would You Rather for All Ages',
    description:
      'Family game night ideas with no board, no cards and no setup: 20 would-you-rather questions for kids and grown-ups, plus three ways to play.',
    intro: [
      'A good family game night needs a game everyone can join in two minutes. Would-you-rather needs nothing: no board, no pieces, no score sheet. One person reads a question, everyone picks a side, and then you find out who picked what and why.',
      'These 20 questions are chosen to work with a mixed group, from a five-year-old to the grown-ups. They start easy, get sillier, then end with questions about your own family. Play a few rounds before the movie, or make a whole evening of it.',
    ],
    sections: [
      {
        heading: 'Warm-up questions',
        text: 'Easy and quick, so the youngest player gets a turn right away.',
        ids: ['kf-57', 'kf-137', 'kf-143', 'kf-150'],
      },
      {
        heading: 'Silly questions that start the arguing',
        text: 'These are the ones people end up defending out loud.',
        ids: ['kf-29', 'kf-33', 'kf-36', 'kf-44', 'kf-34'],
      },
      {
        heading: 'Imagination questions',
        text: 'Ask each player to describe their pick: where it is, what it looks like, who they would invite.',
        ids: ['kf-2', 'kf-3', 'kf-20', 'kf-24', 'kf-174'],
      },
      {
        heading: 'Questions about your own family',
        text: 'Save these for last. The answers tell you what everyone at the table would actually choose.',
        ids: ['kf-154', 'kf-156', 'kf-164', 'kf-163', 'kf-180', 'kf-193'],
      },
    ],
    tips: [
      'Stand-up version: one side of the room is the first choice, the other side is the second. Everyone walks to their pick.',
      'Guess-who version: before the answers, everyone guesses what the person next to them will pick. Then check.',
      'Grown-ups against kids: both teams pick a side, and a team scores a point if most of its players agree.',
      'Let the youngest player read the questions, with help on the long words.',
      'Keep a "pass" rule: nobody has to answer a question they do not like.',
    ],
    landing: ['would-you-rather-questions-for-family', 'funny-would-you-rather-questions-for-kids', 'dinner-table-conversation-starters'],
  },
];

export function guideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug);
}

export const guideQuestionIds = (guide) => guide.sections.flatMap((s) => s.ids);
