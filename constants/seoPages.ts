/**
 * SEO landing pages: the single source of truth.
 *
 * Everything that has to agree about these pages reads this registry: the route
 * files (app/<slug>.tsx), the page component, the JSON-LD, the sitemap
 * generator, the vercel.json rewrites and scripts/verify-seo.ts. Add a page
 * here, add its thin route file and its vercel.json rewrite, and the build
 * checks tell you if anything is missing.
 *
 * Where the pages come from: docs/seo/keyword-research-2026-11.md (one page per
 * search-intent cluster) and the process in docs/seo-content-skill.md.
 *
 * Adult pages list only questions a first-time visitor can play for free
 * (getAccessibleQuestions with categoryUnlocked = false), so they never publish
 * locked expansion or premium text. Kids pages are the one exception (decision D4,
 * docs/specs/kids-family-categories.md §7): they list their full written set, which
 * is already public and indexed. The paywall gates the in-app category run, new
 * writing and AI, not these pages.
 */
import {
  CATEGORIES,
  DARING,
  QUESTIONS,
  getAccessibleQuestions,
  type CategoryDef,
  type CategoryId,
  type Question,
} from './questions';

export type Persona = 'parents' | 'couples' | 'groups';
export type FunnelStage = 'tofu' | 'mofu' | 'bofu';

export interface SeoTip {
  title: string;
  body: string;
}

export interface SeoPageDef {
  /** URL path segment; also the route file name (app/<slug>.tsx). */
  slug: string;
  /** <title> and og:title. Keep under ~60 characters. */
  title: string;
  /** meta description and og:description. Keep under ~155 characters. */
  description: string;
  /** Visible <h1>. */
  headline: string;
  subheadline: string;
  ctaLabel: string;
  /** Who the page is for, and where in the funnel it sits (docs/seo/). */
  persona: Persona;
  funnel: FunnelStage;
  /** schema.org Audience.audienceType. */
  audienceType: string;
  /** Suggested age range, when the page is written for children (schema.org PeopleAudience). */
  ages?: { min: number; max: number };
  /** Short "best for" line under the headline, e.g. "Ages 4–6 · car rides · bedtime". */
  bestFor?: string;
  /**
   * Answer-first block (for search snippets and answer engines): a question-shaped
   * H2 and a direct 40–60-word answer, shown above everything else after the hero.
   */
  answerQuestion?: string;
  answer?: string;
  /** Visible Q&A, mirrored in FAQPage JSON-LD. Unique per page. */
  faq?: { q: string; a: string }[];
  /** Date the page content last changed (YYYY-MM-DD). Shown on the page and as dateModified. */
  updated?: string;
  /** Intro paragraphs: why this list, who it is for. Unique per page. */
  intro?: string[];
  /** How-to-play and parent tips. Unique per page. */
  tips?: SeoTip[];
  /** Section heading above the question list. */
  listHeading?: string;
  /**
   * Draw the page's questions from the questions tagged with this value
   * (the Kids & Family bank). Takes precedence over categoryIds.
   */
  questionTag?: string;
  /** Otherwise: categories to draw from, listed round-robin so the page stays varied. */
  categoryIds: CategoryId[];
  /** Max questions on the page. */
  limit: number;
  keywords: string[];
}

export const SEO_PAGES: SeoPageDef[] = [
  // ======================================================================
  // Persona: parents of young kids (batch 1, #63)
  // ======================================================================
  {
    slug: 'would-you-rather-questions-for-kids',
    title: 'Would You Rather Questions for Kids (Ages 5–10)',
    description:
      '25 would you rather questions for kids, written for ages 5 to 10. Tap any question to play it with your child in seconds. Free, no sign-up.',
    headline: '"Would You Rather" Questions for Kids',
    subheadline:
      'Twenty-five questions written for kids, not adults with the edges sanded off. Read one aloud, or tap it and let them pick.',
    ctaLabel: 'Play a Kids Question →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents of children aged 5 to 10',
    ages: { min: 5, max: 10 },
    bestFor: 'Ages 5–10 · dinner · car rides · waiting rooms',
    answerQuestion: "What are good \"would you rather\" questions for kids?",
    answer:
      "Good \"would you rather\" questions for kids offer two choices a child genuinely wants, like flying or turning invisible, or a treehouse or a castle, and a reason they can explain. For ages 5 to 10, keep them concrete, happy and short. Then ask \"why?\" The follow-up turns a quick pick into a real conversation.",
    faq: [
      { q: "How do you play \"would you rather\" with kids?", a: "Read a question aloud, let your child pick one side, then ask why. Take turns: kids love asking grown-ups the next one. There are no points and no wrong answers." },
      { q: "What age is \"would you rather\" good for?", a: "Kids from about age 4 can play with simple picks like puppy or kitten. From 6 to 10 they enjoy bigger what-ifs with a reason, and teens and adults play harder versions." },
    ],
    intro: [
      'A good "would you rather" question for a kid has two answers they actually want, and a reason they can say out loud. That is all these are: big, happy choices about flying, dragons, treehouses and talking dogs.',
      'The questions are the conversation starter. The fun is in the follow-up: "Why that one?" A five-year-old will give you one word. A ten-year-old will give you a speech.',
    ],
    tips: [
      { title: 'Ask "why?" every time', body: 'The answer matters less than the reason. One "why" turns a two-second pick into a two-minute conversation.' },
      { title: 'Let them ask you', body: 'Kids love catching grown-ups on a hard choice. Hand over the phone and let them read the next one to you.' },
      { title: 'Younger than five?', body: 'Try the kindergarten list: shorter choices, things they can picture.' },
    ],
    listHeading: '25 "Would You Rather" Questions for Kids',
    questionTag: 'kids',
    categoryIds: ['kids-family'],
    limit: 25,
    keywords: ['would you rather questions for kids', 'kids would you rather questions', 'would you rather for kids'],
  },
  {
    slug: 'funny-would-you-rather-questions-for-kids',
    title: 'Funny Would You Rather Questions for Kids',
    description:
      '20 funny would you rather questions for kids: spaghetti hair, penguin walks and sneezing confetti. Silly enough for giggles, clean enough for anyone.',
    headline: 'Funny "Would You Rather" Questions for Kids',
    subheadline: 'Silly, ridiculous and 100% clean. Guaranteed to get a giggle out of the back seat.',
    ctaLabel: 'Play a Funny One →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents of children aged 5 to 11',
    ages: { min: 5, max: 11 },
    bestFor: 'Ages 5–11 · grumpy moods · long waits · sleepovers',
    answerQuestion: "What are funny \"would you rather\" questions for kids?",
    answer:
      "Funny \"would you rather\" questions for kids pair two equally silly outcomes: spaghetti for hair or sausages for fingers, quacking when you laugh or mooing when you sneeze. They work because neither answer is right, so kids argue the case. Keep them clean: silly and absurd, never mean or about anyone's body.",
    faq: [
      { q: "What makes a \"would you rather\" question funny for kids?", a: "Picture-able absurdity. Kids laugh hardest at things they can imagine doing, like walking like a penguin forever, especially when both options are equally ridiculous." },
      { q: "Are funny \"would you rather\" questions OK for school?", a: "These are. They stick to silly situations, animals and food, with no crude humor or insults, so they suit classrooms, car pools and sleepovers." },
    ],
    intro: [
      'Funny questions work because there is no right answer, just two equally ridiculous futures. Spaghetti for hair, or sausages for fingers? Kids will argue it like a court case.',
      'Everything here is clean. No potty humor beyond a burp, nothing mean, nothing about anyone\'s body that could sting.',
    ],
    tips: [
      { title: 'Act it out', body: 'If the answer is "walk like a penguin", they have to walk like a penguin to the car. Instant mood fix.' },
      { title: 'Make up the next one', body: 'After five or six, kids start inventing their own. Let them. That is the point.' },
    ],
    listHeading: '20 Funny "Would You Rather" Questions',
    questionTag: 'funny',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['funny would you rather questions for kids', 'silly would you rather questions for kids', 'funny would you rather questions'],
  },
  {
    slug: 'would-you-rather-questions-for-kindergarten',
    title: 'Would You Rather Questions for Kindergarten & Preschool',
    description:
      '20 would you rather questions for kindergarten and preschool kids, ages 4 to 6. Short choices they can picture: puppies or kittens, swings or slide.',
    headline: '"Would You Rather" Questions for Kindergarten',
    subheadline: 'Short, simple choices for ages 4 to 6. No reading needed: you say it, they pick.',
    ctaLabel: 'Play With Your Little One →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents and teachers of children aged 4 to 6',
    ages: { min: 4, max: 6 },
    bestFor: 'Ages 4–6 · preschool · kindergarten · bedtime',
    answerQuestion: "What are good \"would you rather\" questions for kindergarten?",
    answer:
      "For kindergarten and preschool, ages 4 to 6, the best \"would you rather\" questions are two short things a child can picture: puppy or kitten, swings or slide, snow or sand. Read them aloud so no reading is needed, let them point to choose, and ask for one \"because.\" One reason is a win at this age.",
    faq: [
      { q: "Can 4-year-olds play \"would you rather\"?", a: "Yes, if the choices are two concrete, familiar things such as animals, colors, foods or playground toys. Skip hypotheticals that need weighing trade-offs; those suit ages 6 and up." },
      { q: "How do teachers use \"would you rather\" in kindergarten?", a: "Read one question at circle time and have children move to one side of the rug or the other. It is a quick movement break and a gentle speaking-and-listening exercise." },
    ],
    intro: [
      'Little kids can\'t weigh "fly at walking pace or run at 100 miles an hour". They can choose between a puppy and a kitten, and tell you why with total conviction.',
      'Every question on this page is two things a four-year-old can picture: animals, colors, foods, the playground. Each one also gives them a word or two to explain, which is great practice for talking about what they like.',
    ],
    tips: [
      { title: 'Point to pick', body: 'Hold up your left hand for one answer and your right for the other. Pre-readers can point instead of answer.' },
      { title: 'One "because"', body: 'Ask for one "because…". At this age a single reason is a win.' },
      { title: 'Circle time', body: 'Teachers: read one aloud and have kids stand on one side of the rug or the other. It makes a quick, wiggly vote.' },
    ],
    listHeading: '20 Questions for Ages 4–6',
    questionTag: 'little',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['would you rather questions for kindergarten', 'would you rather questions for preschoolers', 'would you rather questions for 5 year olds'],
  },
  {
    slug: 'would-you-rather-questions-for-elementary-students',
    title: 'Would You Rather Questions for Elementary Students',
    description:
      '20 would you rather questions for elementary students (grades 1–5). Mind-reading, volcano field trips and robot friends: great for class or the car.',
    headline: '"Would You Rather" Questions for Elementary Students',
    subheadline: 'For grades 1 to 5: bigger ideas, real reasons, and the occasional heated debate.',
    ctaLabel: 'Play a Question →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents and teachers of children aged 6 to 10',
    ages: { min: 6, max: 10 },
    bestFor: 'Grades 1–5 · morning meeting · after school · car pool',
    answerQuestion: "What are good \"would you rather\" questions for elementary students?",
    answer:
      "Good \"would you rather\" questions for elementary students (grades 1 to 5) pose two appealing ideas a child can argue for: read minds or see the future, invent a sport or an ice cream flavor, explore a shipwreck or a pyramid. They work as morning-meeting warm-ups, after-school openers and quick persuasive-writing prompts.",
    faq: [
      { q: "How do you use \"would you rather\" questions in the classroom?", a: "Put each option on opposite walls, have students move to their choice, then invite one reason from each side. Let students switch sides after hearing a good argument." },
      { q: "Are \"would you rather\" questions good for writing prompts?", a: "Yes. Have students pick a side and give three reasons. It is a natural, low-stakes introduction to opinion and persuasive writing for grades 2 to 5." },
    ],
    intro: [
      'By first grade kids can hold two ideas in their head and argue for one. These questions use that: read minds or see the future, write a famous book or make a famous movie.',
      'They make good warm-ups for persuasive writing too. Pick one, take a side, and give three reasons.',
    ],
    tips: [
      { title: 'After-school opener', body: '"How was school?" gets "fine". "Would you rather have recess all day or art all day?" gets an actual answer, and often a story about their day.' },
      { title: 'Classroom vote', body: 'Teachers: put the two options on opposite walls. Students move, then one from each side gives a reason.' },
      { title: 'Change your mind', body: 'Let kids switch sides after hearing someone else\'s reason. Learning to change your mind is the hidden lesson.' },
    ],
    listHeading: '20 Questions for Grades 1–5',
    questionTag: 'elementary',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['would you rather questions for elementary students', 'would you rather questions for first graders', 'would you rather questions for 3rd graders'],
  },
  {
    slug: 'gross-would-you-rather-questions',
    title: 'Gross Would You Rather Questions (Kid-Safe)',
    description:
      '15 gross would you rather questions for kids: worm sandwiches, slime socks and pudding pools. Disgusting enough to delight, clean enough for dinner.',
    headline: 'Gross "Would You Rather" Questions',
    subheadline: 'Worms, slime and stinky socks. Gross enough to make them squeal, clean enough for the dinner table (mostly).',
    ctaLabel: 'Play If You Dare →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents of children aged 6 to 11',
    ages: { min: 6, max: 11 },
    bestFor: 'Ages 6–11 · sleepovers · camping · road trips',
    answerQuestion: "What are gross \"would you rather\" questions for kids?",
    answer:
      "Gross \"would you rather\" questions for kids pit two disgusting-but-harmless choices against each other: a worm sandwich or a bug smoothie, a pool of pudding or a pool of baked beans. Kid-safe gross means mud, slime, bugs and stinky socks, not crude humor. They are best at sleepovers, campfires and on long road trips.",
    faq: [
      { q: "Are gross \"would you rather\" questions appropriate for kids?", a: "Kid-safe versions are: they stick to slime, mud, bugs and smells. Avoid crude bathroom humor or anything about real people, and save them for after dinner." },
      { q: "What age kids like gross \"would you rather\" questions?", a: "Roughly ages 6 to 11. That is the peak gross-out age, when both options being awful is exactly what makes it fun." },
    ],
    intro: [
      'Nothing gets a room of eight-year-olds louder than "worm sandwich or bug smoothie?" Gross-out questions are pure fun. Both choices are awful, so nobody can be wrong.',
      'Kid-safe means gross, not crude. These stick to mud, slime, bugs and stinky socks.',
    ],
    tips: [
      { title: 'Save it for the right moment', body: 'These are a riot at a sleepover or around a campfire. Maybe not mid-spaghetti.' },
      { title: 'The grossness scale', body: 'Have everyone rate each question from 1 to 10 for grossness. The arguing over the scores is half the fun.' },
    ],
    listHeading: '15 Gross "Would You Rather" Questions',
    questionTag: 'gross',
    categoryIds: ['kids-family'],
    limit: 15,
    keywords: ['gross would you rather questions', 'gross would you rather questions for kids', 'disgusting would you rather questions'],
  },
  {
    slug: 'this-or-that-questions-for-kids',
    title: 'This or That Questions for Kids: 20 Quick Picks',
    description:
      '20 this or that questions for kids: pizza or tacos, cats or dogs, space or ocean. Fast two-word picks for little kids, car rides and getting to know you.',
    headline: 'This or That Questions for Kids',
    subheadline: 'Two words, one pick, no thinking time. The fastest way to find out what your kid is into this week.',
    ctaLabel: 'Start Picking →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Parents of children aged 4 to 10',
    ages: { min: 4, max: 10 },
    bestFor: 'Ages 4–10 · speed rounds · new friends · first day of school',
    answerQuestion: "What are this or that questions for kids?",
    answer:
      "This or that questions for kids are quick two-word picks: pizza or tacos, cats or dogs, space or ocean. They are the simplest form of \"would you rather\", with no scenario and no wrong answer, so they suit kids as young as 4. They are great as speed rounds, icebreakers between new friends and first-day-of-school openers.",
    faq: [
      { q: "What is the difference between this or that and \"would you rather\"?", a: "This or that is two single words or things; \"would you rather\" adds a scenario, like flying versus turning invisible. This or that is faster and easier for young children." },
      { q: "How do you play this or that with kids?", a: "Read pairs quickly and have kids answer without thinking. For a twist, guess their answer before they say it and keep score." },
    ],
    intro: [
      'This or that is "would you rather" at top speed. No scenarios, just two words: pizza or tacos? Morning or night? Sharks or dinosaurs?',
      'It\'s the easiest version for younger kids and a great icebreaker when kids don\'t know each other yet. Their answers also make a fun little snapshot to compare a year from now.',
    ],
    tips: [
      { title: 'Speed round', body: 'Read them as fast as you can. No hesitating allowed. First answer counts.' },
      { title: 'Guess first', body: 'Before they answer, guess what they will pick. Keep score. Do you really know your kid?' },
    ],
    listHeading: '20 This or That Questions',
    questionTag: 'this-or-that',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['this or that questions for kids', 'this or that for kids', 'this or that questions'],
  },
  {
    slug: 'thanksgiving-would-you-rather-questions',
    title: 'Thanksgiving Would You Rather Questions for Kids & Family',
    description:
      '15 Thanksgiving would you rather questions for kids and family: pie vs turkey, kids table vs grown-ups table. Fun for the table while dinner cooks.',
    headline: 'Thanksgiving "Would You Rather" Questions',
    subheadline: 'Pie or turkey? Kids table or grown-ups table? Something for every generation at the table while the turkey rests.',
    ctaLabel: 'Play at the Table →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Families with children',
    ages: { min: 4, max: 12 },
    bestFor: 'All ages · Thanksgiving dinner · the wait before dinner',
    answerQuestion: "What are good Thanksgiving \"would you rather\" questions?",
    answer:
      "Good Thanksgiving \"would you rather\" questions are about the day itself: pie or turkey, the kids table or the grown-ups table, watching the parade or playing football in the yard. They give every generation, from grandparents to preschoolers, something easy to answer, with nothing political or divisive. Go around the table, youngest first.",
    faq: [
      { q: "How do you play \"would you rather\" at Thanksgiving dinner?", a: "Pick one question, go around the table and let everyone answer, starting with the youngest so kids do not copy the adults. Putting a child in charge of asking keeps them at the table." },
      { q: "Are these Thanksgiving questions good for kids?", a: "Yes. They are written for ages 4 to 12 and center on food, traditions and family, so grandparents and toddlers can answer the same question." },
    ],
    intro: [
      'Thanksgiving puts three generations at one table, and it can be hard to find something they all want to talk about. A light question everyone can answer helps: grandparents, cousins, the four-year-old.',
      'These are all about the day itself: food, traditions, parades and leftovers. Nothing political, nothing divisive.',
    ],
    tips: [
      { title: 'Go around the table', body: 'One question, everyone answers, youngest first so the kids don\'t just copy the grown-ups.' },
      { title: 'Kids host', body: 'Put a kid in charge of asking the questions. It gives them a job and keeps them at the table longer.' },
    ],
    listHeading: '15 Thanksgiving Questions',
    questionTag: 'thanksgiving',
    categoryIds: ['kids-family'],
    limit: 15,
    keywords: ['thanksgiving would you rather questions', 'thanksgiving would you rather questions for kids', 'thanksgiving games for family'],
  },
  {
    slug: 'christmas-would-you-rather-questions-for-kids',
    title: 'Christmas Would You Rather Questions for Kids',
    description:
      '18 Christmas would you rather questions for kids: elves or reindeer, snowman or snowball fight. Festive, free and ready to play at the table or by the tree.',
    headline: 'Christmas "Would You Rather" Questions for Kids',
    subheadline: 'Elves or reindeer? Sledding or skating? Eighteen festive questions for the most wonderful (and most waiting) time of the year.',
    ctaLabel: 'Play a Christmas Question →',
    persona: 'parents',
    funnel: 'tofu',
    audienceType: 'Families with children',
    ages: { min: 4, max: 11 },
    bestFor: 'Ages 4–11 · Christmas Eve · holiday travel · school parties',
    answerQuestion: "What are good Christmas \"would you rather\" questions for kids?",
    answer:
      "Good Christmas \"would you rather\" questions for kids are festive and easy to picture: be one of Santa's elves or one of his reindeer, build a snowman or have a snowball fight, open one present a day or all at once. They fill December's waiting time, from car rides to Christmas Eve, and work for school parties too.",
    faq: [
      { q: "How can families use Christmas \"would you rather\" questions?", a: "Play one question each night in December as a small advent tradition, or use them on holiday car trips and while waiting for relatives to arrive." },
      { q: "Are Christmas \"would you rather\" questions good for a class party?", a: "Yes. Read a question aloud and have children vote by standing on the elf side or the reindeer side of the room. It takes seconds and gets everyone moving." },
    ],
    intro: [
      'December is full of waiting: for the cookies to bake, for relatives to arrive, for Christmas morning. These questions fill the gaps with something better than "are we there yet?"',
      'They are all about the season: snow, Santa\'s workshop, gingerbread, presents, hot chocolate. Grandparents and kids can play them together.',
    ],
    tips: [
      { title: 'An advent question', body: 'Play one question a night in December. It becomes a small tradition the kids remind you about.' },
      { title: 'Class party', body: 'Teachers: read one aloud and have kids vote by standing on the "elf" side or the "reindeer" side of the room.' },
    ],
    listHeading: '18 Christmas Questions',
    questionTag: 'christmas',
    categoryIds: ['kids-family'],
    limit: 18,
    keywords: ['christmas would you rather questions for kids', 'christmas would you rather questions', 'christmas games for kids'],
  },
  {
    slug: 'would-you-rather-questions-for-family',
    title: 'Would You Rather Questions for Family Game Night',
    description:
      '20 would you rather questions for the whole family: switch jobs for a day, family band or sports team. Made for game night with kids and grandparents.',
    headline: '"Would You Rather" Questions for Family',
    subheadline: 'Questions about your family, for your family. Everyone from age five to eighty-five gets a vote.',
    ctaLabel: 'Start Family Game Night →',
    persona: 'parents',
    funnel: 'mofu',
    audienceType: 'Families with children',
    ages: { min: 5, max: 99 },
    bestFor: 'All ages · game night · holidays · family meetings',
    answerQuestion: "What are good \"would you rather\" questions for families?",
    answer:
      "Good \"would you rather\" questions for families are about the family itself: switch jobs for a day, start a family band or a sports team, camp in the backyard or build a living-room fort. Everyone from age 5 to 85 can answer, and many double as real plans for game night. If the family votes for breakfast for dinner, make it happen.",
    faq: [
      { q: "How do you play \"would you rather\" for family game night?", a: "Take turns reading questions; everyone answers and explains. Before answering, have everyone predict how the family vote will split. Closest guess picks the next question." },
      { q: "Can grandparents play \"would you rather\" remotely?", a: "Yes. Share a question link to the family group chat and let relatives answer from wherever they are; it often gets replies from people who rarely join in." },
    ],
    intro: [
      'Most "would you rather" lists are about you. These are about your family: what you would do together, where you would go, who would be in charge. That makes the answers more interesting, because everyone has an opinion about everyone else\'s pick.',
      'Many of them double as real plans. If everyone picks "backyard campout", you know what next Saturday is.',
    ],
    tips: [
      { title: 'Majority rules (sometimes)', body: 'Pick one question a week where the winning answer actually happens: breakfast for dinner, a living-room fort.' },
      { title: 'Predict the family', body: 'Before anyone answers, everyone guesses how the family vote will split. Closest guess picks the next question.' },
      { title: 'Include the grandparents', body: 'Send one question to the family group chat with the share button. You\'ll get answers from people you didn\'t expect.' },
    ],
    listHeading: '20 Family "Would You Rather" Questions',
    questionTag: 'family',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['would you rather questions for family', 'family would you rather questions', 'would you rather questions for family game night'],
  },
  {
    slug: 'dinner-table-conversation-starters',
    title: 'Family Dinner Questions & Conversation Starters',
    description:
      '20 family dinner questions and conversation starters for kids: dinner on the moon, best part of your day, oldest or youngest. Phones down, talking up.',
    headline: 'Family Dinner Conversation Starters',
    subheadline: 'Twenty "would you rather" questions that get kids talking at dinner, and keep them at the table a little longer.',
    ctaLabel: 'Start the Conversation →',
    persona: 'parents',
    funnel: 'mofu',
    audienceType: 'Families with children',
    ages: { min: 5, max: 12 },
    bestFor: 'Ages 5–12 · weeknight dinners · restaurants · picnics',
    answerQuestion: "What are good family dinner conversation starters?",
    answer:
      "Good family dinner conversation starters are easy to answer and hard to stop at one word. \"Would you rather\" questions work well: eat dinner on the moon or under the sea, be famous for being kind or for being brave. One good question per dinner, with a follow-up \"why?\", beats a quiz. Let a different family member choose each night.",
    faq: [
      { q: "How do you get kids to talk at dinner?", a: "Swap \"how was your day?\" for a light \"would you rather\" question, answer it yourself first, then ask why. Kids open up more when parents give honest answers too." },
      { q: "How many conversation starters should you use at dinner?", a: "One or two. A single good question with follow-ups keeps the conversation going without turning dinner into a quiz." },
    ],
    intro: [
      'Weeknight dinner is often the only time the whole family sits down together, and "how was your day?" usually ends the conversation instead of starting it.',
      'A "would you rather" question works better because it\'s easy to answer and hard to stop at one word. Some of these are pure fun. Others, like "be famous for being kind or brave?", open up what your kid cares about without feeling like a test.',
    ],
    tips: [
      { title: 'One question per dinner', body: 'Don\'t turn dinner into a quiz. One good question, with follow-ups, beats ten fast ones.' },
      { title: 'Rotate the asker', body: 'A different family member picks the question each night. Kids take the job very seriously.' },
      { title: 'Grown-ups answer too', body: 'Kids open up more when parents answer honestly first. Show them how a real answer sounds.' },
    ],
    listHeading: '20 Family Dinner Questions',
    questionTag: 'dinner',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['family dinner questions', 'dinner table conversation starters', 'dinner conversation starters for families'],
  },
  {
    slug: 'road-trip-would-you-rather-questions',
    title: 'Road Trip Would You Rather Questions for Kids',
    description:
      '20 road trip would you rather questions for kids: flying cars, rest-stop treasure, moose or bear. A no-screens car game for the whole family. Free.',
    headline: 'Road Trip "Would You Rather" Questions',
    subheadline: 'The car game that needs no board, no pieces and no batteries. Just a driver who can read the next question.',
    ctaLabel: 'Start the Car Game →',
    persona: 'parents',
    funnel: 'mofu',
    audienceType: 'Families with children',
    ages: { min: 4, max: 12 },
    bestFor: 'Ages 4–12 · long drives · flights · traffic jams',
    answerQuestion: "What are good road trip \"would you rather\" questions for kids?",
    answer:
      "Good road trip \"would you rather\" questions for kids are about the trip itself: a car that flies over traffic or drives underwater, an ice cream stop or a playground stop, a moose or a bear by the road. \"Would you rather\" is an ideal car game: nothing to set up, no pieces to lose, and it works for ages 4 to 12 at once.",
    faq: [
      { q: "How do you play \"would you rather\" in the car?", a: "The front-seat passenger reads questions from a phone and everyone answers, including the driver, eyes on the road. Kids who can read can take turns being question master." },
      { q: "What are good screen-free car games for kids?", a: "\"Would you rather\", I spy, the alphabet game and twenty questions all need nothing but voices. \"Would you rather\" works across the widest age range because there is no right answer." },
    ],
    intro: [
      'Hour three of a road trip is when tablets die and patience runs out. "Would you rather" is the perfect car game: nothing to set up, nothing to drop under the seat, and it works for a four-year-old and a teenager at once.',
      'These questions are all about the trip itself: cars that fly, rest-stop treasure, which museum to visit, who controls the music.',
    ],
    tips: [
      { title: 'Passenger reads, everyone answers', body: 'The front-seat passenger reads from the phone; the driver answers too, eyes on the road.' },
      { title: 'Turn it into a plan', body: 'If the car votes for the ice cream stop, make it happen at the next exit. Kids remember the game that came true.' },
      { title: 'Rotate the question master', body: 'Kids who can read take turns reading the questions. Whoever reads also gets to ask "why?"' },
    ],
    listHeading: '20 Road Trip Questions',
    questionTag: 'road-trip',
    categoryIds: ['kids-family'],
    limit: 20,
    keywords: ['road trip would you rather questions', 'road trip games for kids', 'car games for kids'],
  },
  {
    slug: 'would-you-rather-app',
    title: 'Would You Rather App: Free, In Your Browser',
    description:
      'A free would you rather app that runs in your browser: nothing to install, no account. Kids & Family pack, dinner, road trip and couples questions.',
    headline: 'The "Would You Rather" App',
    subheadline: 'Free, in your browser, nothing to install and no account. Open it, tap a side, pass the phone.',
    ctaLabel: 'Open the App →',
    persona: 'parents',
    funnel: 'bofu',
    audienceType: 'Families, couples and friends',
    bestFor: 'Phones, tablets and laptops · works in any browser',
    answerQuestion: "Is there a free \"would you rather\" app?",
    answer:
      "Yes. This \"would you rather\" app is free and runs in any phone, tablet or laptop browser, with nothing to install and no account. It includes a free Kids & Family pack for ages 4 to 11 plus packs for dinner tables, deep conversations and couples. Every question has a share link, so you can send one to friends or family.",
    faq: [
      { q: "Do I need to download the \"would you rather\" app?", a: "No. It runs in the browser. To open it like an app, add it to your home screen: on iPhone tap Share then Add to Home Screen, on Android tap the menu then Add to Home screen." },
      { q: "Is the \"would you rather\" app safe for kids?", a: "The Kids & Family pack is written for ages 4 to 11, with no romance, violence, brands or scary themes. Adult packs are labeled separately." },
    ],
    intro: [
      'Most "would you rather" apps want a download, an account, or your attention for ads. This one is a web page. Open it on any phone, tablet or laptop and start playing in one tap.',
      'There is a free Kids & Family pack written for ages 4 to 11, plus packs for dinner tables, deep conversations and couples. Each question has a shareable card, so you can send one to the family group chat and see who answers.',
    ],
    tips: [
      { title: 'How it works', body: 'Pick a pack. Read the two options. Tap the one you\'d choose. Pass the phone to the next person, or share the question so someone far away can answer.' },
      { title: 'Safe for kids', body: 'The Kids & Family pack has no romance, no violence, no brands and nothing scary. Start kids there; the adult packs are clearly labelled.' },
      { title: 'Add it to your home screen', body: 'On iPhone, tap Share → Add to Home Screen. On Android, tap the menu → Add to Home screen. It then opens like any other app.' },
    ],
    listHeading: '10 Questions to Start With',
    questionTag: 'app',
    categoryIds: ['kids-family'],
    limit: 10,
    keywords: ['would you rather app', 'would you rather game online', 'free would you rather game'],
  },

  // ======================================================================
  // Persona: couples / adults (pre-batch pages from PR #43; next batch)
  // ======================================================================
  {
    slug: 'deep-would-you-rather-questions',
    title: 'Deep Would You Rather Questions — Thought-Provoking Dilemmas',
    description:
      "Deep Would You Rather questions about values, desires and what people rarely say out loud. Ideal for late nights and real conversations. Free to start.",
    headline: 'Deep "Would You Rather" Questions',
    subheadline:
      "The questions you don't normally ask. Reveal what people actually value — and what they secretly fear. Best played after midnight.",
    ctaLabel: 'Go Deep →',
    persona: 'couples',
    funnel: 'tofu',
    audienceType: 'Adults',
    categoryIds: DARING,
    limit: 20,
    keywords: ['deep would you rather questions', 'thought-provoking questions', 'late night conversation'],
  },
  {
    slug: 'questions-for-couples',
    title: 'Would You Rather Questions for Couples — Deepen Your Connection',
    description:
      "Would You Rather questions for couples that reveal how you really think. Ideal for date nights and long conversations. Free to start, no account needed.",
    headline: '"Would You Rather" for Couples',
    subheadline:
      'You think you know each other. These questions will surprise you. Share a question, compare answers, and see where you actually stand.',
    ctaLabel: 'Play Together →',
    persona: 'couples',
    funnel: 'tofu',
    audienceType: 'Couples',
    // Not midnight-secrets / deep-desires: the deep page lists those (one page per question).
    categoryIds: ['moral-compass'],
    limit: 20,
    keywords: ['would you rather questions for couples', 'date night questions', 'couples conversation starters'],
  },
];

/** When the landing-page copy last changed; pages can override with `updated`. */
export const SEO_PAGES_UPDATED = '2026-11-17';

export function getSeoPageUpdated(page: SeoPageDef): string {
  return page.updated ?? SEO_PAGES_UPDATED;
}

export function getSeoPage(slug: string): SeoPageDef | undefined {
  return SEO_PAGES.find((p) => p.slug === slug);
}

/** Other pages for the same persona, then the rest: the page's internal links. */
/**
 * Kids pages: written for parents and played by children (ages 4–11). They list and link
 * only to kids-audience categories (`isKidsCategoryId`) and to other kids pages. `verify-seo` enforces this.
 */
export const isKidsPage = (page: SeoPageDef): boolean => page.persona === 'parents';

/** Kids pages are tagged to the kids bank and (D4) list that bank's full written set. */
export const listsFullWrittenSet = (page: SeoPageDef): boolean => isKidsPage(page) && !!page.questionTag;

export function getRelatedSeoPages(page: SeoPageDef): { samePersona: SeoPageDef[]; other: SeoPageDef[] } {
  const others = SEO_PAGES.filter((p) => p.slug !== page.slug);
  return {
    samePersona: others.filter((p) => p.persona === page.persona),
    // A kids page never links out to adult lists (deep questions, couples, ...).
    other: isKidsPage(page) ? [] : others.filter((p) => p.persona !== page.persona),
  };
}

/**
 * The questions a page lists.
 *
 * Tagged kids pages take the questions written for them, free or not (D4), in bank order. Otherwise
 * only free, playable questions are listed, drawn round-robin across the page's categories, so a
 * three-category page is not twenty questions from the first.
 */
export function getSeoPageQuestions(page: SeoPageDef): Question[] {
  if (page.questionTag) {
    const categories = new Set(page.categoryIds as string[]);
    const written = (q: Question) => categories.has(q.category) && q.tags?.includes(page.questionTag!);
    if (listsFullWrittenSet(page)) return QUESTIONS.filter(written).slice(0, page.limit);
    const free = new Set(
      page.categoryIds
        .map((id) => CATEGORIES.find((c): c is CategoryDef => c.id === id))
        .filter((c): c is CategoryDef => c !== undefined)
        .flatMap((c) => getAccessibleQuestions(c, false))
        .map((q) => q.id),
    );
    return QUESTIONS.filter((q) => free.has(q.id) && written(q)).slice(0, page.limit);
  }

  const pools = page.categoryIds
    .map((id) => CATEGORIES.find((c): c is CategoryDef => c.id === id))
    .filter((c): c is CategoryDef => c !== undefined)
    .map((c) => getAccessibleQuestions(c, false));

  const picked: Question[] = [];
  for (let round = 0; picked.length < page.limit; round++) {
    let tookAny = false;
    for (const pool of pools) {
      if (round < pool.length && picked.length < page.limit) {
        picked.push(pool[round]);
        tookAny = true;
      }
    }
    if (!tookAny) break;
  }
  return picked;
}
