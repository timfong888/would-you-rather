// First batch of indexed, read-only question pages (/q/<id>), docs/specs/seo-question-pages.md section 1a (#206).
// Batch one is frozen: explicit ids, never recomputed from the data. Plain JS (with seoBatch.d.ts) so the app and the build scripts share it.
// Chosen 2026-11-24: kids and family first (persona 1 is parents), then adult; questions already on the hand-tagged landing
// pages first, then the rest of each kids category's free questions; at most 12 per category; free-tier questions only;
// Midnight Secrets and Deep Desires left out. To extend after the keyword research, add ids in a PR.
export const SEO_FIRST_BATCH = [
  'kf-1', 'kf-2', 'kf-3', 'kf-17', 'kf-20', 'kf-13',
  'kf-24', 'kf-46', 'kf-52', 'kf-56', 'kf-57', 'kf-47',
  'kf-59', 'kf-61', 'kf-58', 'kf-67', 'kf-83', 'kf-71',
  'kf-68', 'kf-81', 'kf-156', 'kf-154', 'kf-169', 'kf-164',
  'kf-26', 'kf-27', 'kf-42', 'kf-28', 'kf-179', 'kf-192',
  'kf-185', 'kf-188', 'kf-178', 'kf-189', 'kf-196', 'kf-197',
  'kf-195', 'kf-202', 'kf-199', 'kf-203', 'kf-205', 'kf-213',
  'kf-101', 'kf-102', 'kf-118', 'kf-91', 'kf-125', 'kf-123',
  'kf-132', 'kf-128', 'kf-137', 'kf-140', 'kf-150', 'kf-143',
  'kf-216', 'mc-1', 'mc-2', 'mc-3', 'mc-4', 'mc-5',
  'mc-6', 'mc-7', 'mc-8', 'mc-9', 'mc-10', 'mc-11',
  'mc-12', 'tt-1', 'wd-1', 'hl-1', 'tt-2', 'wd-2',
  'hl-2', 'tt-3', 'wd-3', 'hl-3', 'kf-244', 'kf-246',
  'kf-251', 'kf-258', 'kf-259', 'kf-271', 'kf-272', 'kf-278',
  'kf-282', 'tn-1', 'tn-2', 'tn-3', 'tn-4', 'tn-7',
  'tn-8', 'tn-9', 'tn-26', 'sb-1', 'sb-2', 'sb-3',
  'sb-4', 'cc-1', 'cc-2', 'cc-3', 'cc-4', 'td-1',
  'td-2', 'td-3', 'td-4',
];

// Second batch, 2026-11-24: 60 more kids-bank questions from the keyword research themes (silly and funny, gross, food and
// dinner table, holiday table, car and road trip). Kids categories only, same kids rules as batch one. These are paid-tier
// questions, which Tim decided to make public (#206: "all withheld paid questions are public"), so their pages lead to the
// category's free questions, not to the paywall. Frozen explicit ids.
export const SEO_BATCH_2 = [
  'kf-29', 'kf-31', 'kf-32', 'kf-33', 'kf-34', 'kf-35',
  'kf-36', 'kf-37', 'kf-38', 'kf-39', 'kf-41', 'kf-43',
  'kf-44', 'kf-45', 'kf-30', 'kf-86', 'kf-87', 'kf-88',
  'kf-90', 'kf-92', 'kf-93', 'kf-95', 'kf-96', 'kf-99',
  'kf-100', 'kf-121', 'kf-126', 'kf-127', 'kf-130', 'kf-133',
  'kf-136', 'kf-138', 'kf-139', 'kf-141', 'kf-142', 'kf-144',
  'kf-145', 'kf-149', 'kf-152', 'kf-157', 'kf-163', 'kf-168',
  'kf-174', 'kf-175', 'kf-176', 'kf-180', 'kf-183', 'kf-184',
  'kf-187', 'kf-190', 'kf-193', 'kf-204', 'kf-207', 'kf-208',
  'kf-209', 'kf-211', 'kf-212', 'kf-234', 'kf-239', 'kf-242',
];

/** Every question with a /q/<id> page, in order: batch one, then batch two. */
export const SEO_QUESTION_PAGES = [...SEO_FIRST_BATCH, ...SEO_BATCH_2];

const BATCH = new Set(SEO_QUESTION_PAGES);

/** True when a question has a /q/<id> page (and so /game/<id> and /p/<id> point their canonical at it). */
export function isSeoBatchId(id) {
  return BATCH.has(id);
}

/** The hand-written landing page each category links to from a question page (kids categories only link to kids pages). */
export const LANDING_FOR_CATEGORY = {
  'tiny-choices': 'would-you-rather-questions-for-kindergarten',
  'make-believe': 'would-you-rather-questions-for-kindergarten',
  'giggle-factory': 'funny-would-you-rather-questions-for-kids',
  'road-trip-rally': 'road-trip-would-you-rather-questions',
  'dinner-table': 'dinner-table-conversation-starters',
  'heart-to-heart': 'would-you-rather-questions-for-family',
  'future-me': 'would-you-rather-questions-for-elementary-students',
  'real-talk': 'would-you-rather-questions-for-family',
  'holiday-table': 'thanksgiving-would-you-rather-questions',
  'moral-compass': 'questions-for-couples',
};
