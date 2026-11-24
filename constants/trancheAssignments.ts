/**
 * Frozen tranche membership for the kids and teen categories (docs/specs/kids-family-categories.md §3.4).
 *
 * A tranche a parent bought (`cat_<category>_<k>`, a non-consumable) must open the SAME questions forever, so the
 * membership is written down here as explicit question ids, not recomputed from the current question count.
 * Generated once from the data on 2026-11-24 with the rule in lib/tranches.ts (`trancheSizes`: 20 per tranche,
 * a remainder under 10 joins the previous one), in id order, after each category's free questions.
 *
 * Rules for changing this file (a payments change, reviewed by Tim):
 *   - Never remove an id from a tranche, never move an id to another tranche, never reorder tranches.
 *   - New paid questions: add them to a NEW tranche at the end (a new product, `trancheSizes` can size it), or append
 *     them to the last tranche (owners gain questions, never lose them).
 *   - A paid question that is in no tranche is CLOSED (only a pack or owner access opens it) until it is assigned.
 *     tests/unit/tranches.test.ts fails when a paid kids or teen question is unassigned, so growing the question
 *     bank forces a deliberate decision here.
 * Adult categories are not in this table: an adult category is one tranche (all its paid questions) on `cat_<id>`.
 */
export const TRANCHE_ASSIGNMENTS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  'tiny-choices': [
    // tranche 1: 22 questions
    ['kf-48', 'kf-49', 'kf-50', 'kf-51', 'kf-53', 'kf-54', 'kf-55', 'kf-60', 'kf-62', 'kf-63', 'kf-64', 'kf-65', 'kf-224', 'kf-225', 'kf-226', 'kf-227', 'kf-228', 'kf-229', 'kf-230', 'kf-231', 'kf-232', 'kf-233'],
  ],
  'make-believe': [
    // tranche 1: 20 questions
    ['kf-4', 'kf-5', 'kf-6', 'kf-7', 'kf-8', 'kf-9', 'kf-10', 'kf-11', 'kf-12', 'kf-14', 'kf-15', 'kf-16', 'kf-18', 'kf-19', 'kf-21', 'kf-22', 'kf-23', 'kf-25', 'kf-66', 'kf-72'],
    // tranche 2: 13 questions
    ['kf-75', 'kf-79', 'kf-82', 'kf-85', 'kf-214', 'kf-215', 'kf-217', 'kf-218', 'kf-219', 'kf-220', 'kf-221', 'kf-222', 'kf-223'],
  ],
  'giggle-factory': [
    // tranche 1: 20 questions
    ['kf-29', 'kf-30', 'kf-31', 'kf-32', 'kf-33', 'kf-34', 'kf-35', 'kf-36', 'kf-37', 'kf-38', 'kf-39', 'kf-40', 'kf-41', 'kf-43', 'kf-44', 'kf-45', 'kf-86', 'kf-87', 'kf-88', 'kf-89'],
    // tranche 2: 27 questions
    ['kf-90', 'kf-92', 'kf-93', 'kf-94', 'kf-95', 'kf-96', 'kf-97', 'kf-98', 'kf-99', 'kf-100', 'kf-103', 'kf-104', 'kf-105', 'kf-106', 'kf-107', 'kf-108', 'kf-109', 'kf-110', 'kf-111', 'kf-112', 'kf-113', 'kf-114', 'kf-115', 'kf-116', 'kf-117', 'kf-119', 'kf-120'],
  ],
  'road-trip-rally': [
    // tranche 1: 22 questions
    ['kf-194', 'kf-198', 'kf-200', 'kf-201', 'kf-204', 'kf-206', 'kf-207', 'kf-208', 'kf-209', 'kf-210', 'kf-211', 'kf-212', 'kf-234', 'kf-235', 'kf-236', 'kf-237', 'kf-238', 'kf-239', 'kf-240', 'kf-241', 'kf-242', 'kf-243'],
  ],
  'dinner-table': [
    // tranche 1: 20 questions
    ['kf-69', 'kf-70', 'kf-73', 'kf-74', 'kf-76', 'kf-77', 'kf-78', 'kf-80', 'kf-84', 'kf-155', 'kf-157', 'kf-158', 'kf-159', 'kf-160', 'kf-161', 'kf-162', 'kf-163', 'kf-165', 'kf-166', 'kf-167'],
    // tranche 2: 19 questions
    ['kf-168', 'kf-170', 'kf-171', 'kf-172', 'kf-173', 'kf-174', 'kf-175', 'kf-176', 'kf-177', 'kf-180', 'kf-181', 'kf-182', 'kf-183', 'kf-184', 'kf-186', 'kf-187', 'kf-190', 'kf-191', 'kf-193'],
  ],
  'heart-to-heart': [
    // tranche 1: 22 questions
    ['kf-245', 'kf-247', 'kf-248', 'kf-249', 'kf-250', 'kf-252', 'kf-253', 'kf-254', 'kf-255', 'kf-256', 'kf-257', 'kf-260', 'kf-261', 'kf-262', 'kf-263', 'kf-264', 'kf-265', 'kf-266', 'kf-267', 'kf-268', 'kf-269', 'kf-270'],
  ],
  'future-me': [
    // tranche 1: 22 questions
    ['kf-273', 'kf-274', 'kf-275', 'kf-276', 'kf-277', 'kf-279', 'kf-280', 'kf-281', 'kf-283', 'kf-284', 'kf-285', 'kf-286', 'kf-287', 'kf-288', 'kf-289', 'kf-290', 'kf-291', 'kf-292', 'kf-293', 'kf-294', 'kf-295', 'kf-296'],
  ],
  'real-talk': [
    // tranche 1: 22 questions
    ['tn-5', 'tn-6', 'tn-10', 'tn-11', 'tn-12', 'tn-13', 'tn-14', 'tn-15', 'tn-16', 'tn-17', 'tn-18', 'tn-19', 'tn-20', 'tn-21', 'tn-22', 'tn-23', 'tn-24', 'tn-25', 'tn-27', 'tn-28', 'tn-29', 'tn-30'],
  ],
  'holiday-table': [
    // tranche 1: 25 questions
    ['kf-121', 'kf-122', 'kf-124', 'kf-126', 'kf-127', 'kf-129', 'kf-130', 'kf-131', 'kf-133', 'kf-134', 'kf-135', 'kf-136', 'kf-138', 'kf-139', 'kf-141', 'kf-142', 'kf-144', 'kf-145', 'kf-146', 'kf-147', 'kf-148', 'kf-149', 'kf-151', 'kf-152', 'kf-153'],
  ],
};
