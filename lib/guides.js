// Pillar guides (/guides/<slug>), issue #211, docs/specs/seo-question-pages.md. Plain JS (with guides.d.ts) so the app and the
// build scripts share it. Question ids are explicit and frozen; every id must be in SEO_FIRST_BATCH (lib/seoBatch.js) so the
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
];

export function guideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug);
}

export const guideQuestionIds = (guide) => guide.sections.flatMap((s) => s.ids);
