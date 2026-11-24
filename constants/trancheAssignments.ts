/**
 * Frozen question membership for the kids and teen categories (docs/specs/kids-family-categories.md §3.4, Tim 2026-11-24).
 *
 * The model (Tim): the first FREE_QUESTIONS_PER_CATEGORY (5) questions of every category are free; the next 20 cost $1.99 in
 * ONE category (the one step below); the $4.99 all-categories pack opens that same step in every category. Tim, later the same
 * day: "just generate for the kids and we won't allow auto generate, max it 20 per kid without the ability to keep going right
 * now". So a kids or teen category stops after its first paid 20: there is no second step. The written questions after that
 * (`withheld`) are kept, not deleted, and stay closed until Tim decides what they become (generation is issue #203, not built).
 *
 * A step a parent bought (`cat_<category>_1`, a non-consumable) must open the SAME questions forever, so membership is written
 * down here as explicit question ids, not recomputed from the current question count. Generated on 2026-11-24 from the data.
 * 9 steps of 20 (180 questions); 101 withheld.
 *
 * Rules for changing this file (a payments change, reviewed by Tim):
 *   - Never remove an id from `tranches`, never move one to another list, never reorder.
 *   - Moving a `withheld` id into a NEW step at the end is how more questions get sold later (owners only gain).
 *   - A paid question that is in neither list is CLOSED until it is assigned. tests/unit/tranches.test.ts fails when one is.
 * Adult categories are not in this table (see lib/tranches.ts): an adult category's one step is everything paid, granted by
 * `cat_<id>`, and the pack opens the first 20 of it.
 */
export interface YoungAssignment {
  /** The steps beyond the free questions, in order (one for now). Step 1 is also what the all-categories pack opens. */
  readonly tranches: readonly (readonly string[])[];
  /** Written, kept, not for sale yet. */
  readonly withheld: readonly string[];
}

export const TRANCHE_ASSIGNMENTS: Readonly<Record<string, YoungAssignment>> = {
  'tiny-choices': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-59', 'kf-61', 'kf-58', 'kf-48', 'kf-49', 'kf-50', 'kf-51', 'kf-53', 'kf-54', 'kf-55', 'kf-60', 'kf-62', 'kf-63', 'kf-64', 'kf-65', 'kf-224', 'kf-225', 'kf-226', 'kf-227', 'kf-228']],
    // written but not sold: positions 26 to 30 (5 questions), closed for everyone but owner access
    withheld: ['kf-229', 'kf-230', 'kf-231', 'kf-232', 'kf-233'],
  },
  'make-believe': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-13', 'kf-216', 'kf-24', 'kf-4', 'kf-5', 'kf-6', 'kf-7', 'kf-8', 'kf-9', 'kf-10', 'kf-11', 'kf-12', 'kf-14', 'kf-15', 'kf-16', 'kf-18', 'kf-19', 'kf-21', 'kf-22', 'kf-23']],
    // written but not sold: positions 26 to 41 (16 questions), closed for everyone but owner access
    withheld: ['kf-25', 'kf-66', 'kf-72', 'kf-75', 'kf-79', 'kf-82', 'kf-85', 'kf-214', 'kf-215', 'kf-217', 'kf-218', 'kf-219', 'kf-220', 'kf-221', 'kf-222', 'kf-223'],
  },
  'giggle-factory': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-101', 'kf-102', 'kf-118', 'kf-29', 'kf-30', 'kf-31', 'kf-32', 'kf-33', 'kf-34', 'kf-35', 'kf-36', 'kf-37', 'kf-38', 'kf-39', 'kf-40', 'kf-41', 'kf-43', 'kf-44', 'kf-45', 'kf-86']],
    // written but not sold: positions 26 to 55 (30 questions), closed for everyone but owner access
    withheld: ['kf-87', 'kf-88', 'kf-89', 'kf-90', 'kf-92', 'kf-93', 'kf-94', 'kf-95', 'kf-96', 'kf-97', 'kf-98', 'kf-99', 'kf-100', 'kf-103', 'kf-104', 'kf-105', 'kf-106', 'kf-107', 'kf-108', 'kf-109', 'kf-110', 'kf-111', 'kf-112', 'kf-113', 'kf-114', 'kf-115', 'kf-116', 'kf-117', 'kf-119', 'kf-120'],
  },
  'road-trip-rally': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-203', 'kf-205', 'kf-213', 'kf-194', 'kf-198', 'kf-200', 'kf-201', 'kf-204', 'kf-206', 'kf-207', 'kf-208', 'kf-209', 'kf-210', 'kf-211', 'kf-212', 'kf-234', 'kf-235', 'kf-236', 'kf-237', 'kf-238']],
    // written but not sold: positions 26 to 30 (5 questions), closed for everyone but owner access
    withheld: ['kf-239', 'kf-240', 'kf-241', 'kf-242', 'kf-243'],
  },
  'dinner-table': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-192', 'kf-185', 'kf-164', 'kf-69', 'kf-70', 'kf-73', 'kf-74', 'kf-76', 'kf-77', 'kf-78', 'kf-80', 'kf-84', 'kf-155', 'kf-157', 'kf-158', 'kf-159', 'kf-160', 'kf-161', 'kf-162', 'kf-163']],
    // written but not sold: positions 26 to 47 (22 questions), closed for everyone but owner access
    withheld: ['kf-165', 'kf-166', 'kf-167', 'kf-168', 'kf-170', 'kf-171', 'kf-172', 'kf-173', 'kf-174', 'kf-175', 'kf-176', 'kf-177', 'kf-180', 'kf-181', 'kf-182', 'kf-183', 'kf-184', 'kf-186', 'kf-187', 'kf-190', 'kf-191', 'kf-193'],
  },
  'heart-to-heart': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-251', 'kf-258', 'kf-259', 'kf-245', 'kf-247', 'kf-248', 'kf-249', 'kf-250', 'kf-252', 'kf-253', 'kf-254', 'kf-255', 'kf-256', 'kf-257', 'kf-260', 'kf-261', 'kf-262', 'kf-263', 'kf-264', 'kf-265']],
    // written but not sold: positions 26 to 30 (5 questions), closed for everyone but owner access
    withheld: ['kf-266', 'kf-267', 'kf-268', 'kf-269', 'kf-270'],
  },
  'future-me': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-71', 'kf-68', 'kf-81', 'kf-273', 'kf-274', 'kf-275', 'kf-276', 'kf-277', 'kf-279', 'kf-280', 'kf-281', 'kf-283', 'kf-284', 'kf-285', 'kf-286', 'kf-287', 'kf-288', 'kf-289', 'kf-290', 'kf-291']],
    // written but not sold: positions 26 to 30 (5 questions), closed for everyone but owner access
    withheld: ['kf-292', 'kf-293', 'kf-294', 'kf-295', 'kf-296'],
  },
  'real-talk': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['tn-8', 'tn-9', 'tn-26', 'tn-5', 'tn-6', 'tn-10', 'tn-11', 'tn-12', 'tn-13', 'tn-14', 'tn-15', 'tn-16', 'tn-17', 'tn-18', 'tn-19', 'tn-20', 'tn-21', 'tn-22', 'tn-23', 'tn-24']],
    // written but not sold: positions 26 to 30 (5 questions), closed for everyone but owner access
    withheld: ['tn-25', 'tn-27', 'tn-28', 'tn-29', 'tn-30'],
  },
  'holiday-table': {
    // the one step: positions 6 to 25 (20 questions), also opened by the pack
    tranches: [['kf-150', 'kf-128', 'kf-143', 'kf-121', 'kf-122', 'kf-124', 'kf-126', 'kf-127', 'kf-129', 'kf-130', 'kf-131', 'kf-133', 'kf-134', 'kf-135', 'kf-136', 'kf-138', 'kf-139', 'kf-141', 'kf-142', 'kf-144']],
    // written but not sold: positions 26 to 33 (8 questions), closed for everyone but owner access
    withheld: ['kf-145', 'kf-146', 'kf-147', 'kf-148', 'kf-149', 'kf-151', 'kf-152', 'kf-153'],
  },
};
