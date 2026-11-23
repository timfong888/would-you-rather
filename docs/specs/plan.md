# Product plan

A short, readable plan for what we are building and in what order. Each item links to its issue and spec.
Keep it current: when a unit ships or the order changes, edit it here.

## Now: kids and family categories (#124)

**Why.** "Kids & Family" is one category of 223 questions, all free. Tim (2026-11-23): it "is not a useful category",
and "having a free category with a hundred questions will reduce monetization". Family and kids is an audience, not
a topic.

**What.** Replace it with eight topic categories (Tiny Choices, Make-Believe, Giggle Factory, Road Trip Rally,
Dinner Table, Heart to Heart, Future Me, Real Talk) and one seasonal one (Holiday Table). Each shows an age range.
Each has 8 free questions; the rest sit behind the normal category unlock ($1.99, or the $4.99 pack). After
unlocking, "More like this" serves new AI-written questions that a person has reviewed.

**Rules that do not change.** Nothing under 13 is tracked and no ID is stored on a kids route. Every purchase from
the kids side sits behind the parental gate. Question ids never change.

**Order.** Spec: `docs/specs/kids-family-categories.md` §6. Issue: #124 (PRD and acceptance tests).

| Unit | What | Review |
|---|---|---|
| 1 | Content: the 9 categories, retag the 223 existing questions, hand-pick the free 8, write 103 new ones | Tim reads all 103 first |
| 2 | Data model: `audience` and `ages` on every category; the kids rules derive from `audience` | Merges on green CI |
| 3 | Browse UI: Grown-ups / With kids switch, age chips, age label on each card | |
| 4 | Payments: 9 new products, paywall copy, gate on every With kids purchase, web shows "unlock in the app" | Tim reviews |
| 5 | AI pool (server): safety filter, generator, review queue, cached endpoint | Tim reviews, approves the first batch |
| 6 | More like this in the app, reports | Tim reviews |
| 7 | Privacy policy, kids counters, listing and review notes, Smart App Banner | Tim reviews the policy text |

Units 1 and 2 ship together and are useful alone: clear, age-labelled categories and a free taste. Unit 1 must not
reach production before Unit 4 is ready, because locking questions makes the catalog derive 9 products that do not
exist in App Store Connect yet (see the PRD on #124). Units 5 and 6 wait until Unit 4 shows parents buy the written
unlock.

## Later

Items from the MVP spec and growth plan that are not scheduled yet live in `docs/specs/growth-plan.md` and
`docs/specs/would-you-rather-mvp.md`.
