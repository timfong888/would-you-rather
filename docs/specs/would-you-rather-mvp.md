# Would You Rather: MVP acceptance criteria

Source: the [PRD](https://docs.google.com/document/d/1QRAFooC6kKWMX6EzvPTp3mr8nmlLp6dzZGbQWLHQ180/edit),
including Tim's decisions of 2026-11-17 and the proposed edits in [#68](https://github.com/timfong888/would-you-rather/issues/68).
Engineering spec: [would-you-rather-mvp-spec.md](would-you-rather-mvp-spec.md).
Test plan: [would-you-rather-mvp-test-plan.md](would-you-rather-mvp-test-plan.md).

**MVP scope:** mobile web, primary persona parents of kids [6–12], played on one phone with no account.
**Out of scope:** native apps, sign-in, AI-generated packs, couples/teen categories, journalist outreach, data reports.

Values in `[brackets]` are open decisions for Tim (see the spec's Open questions). Tests that depend
on one read the value from config and are not written until it is chosen.

## Discover

- **AC-1** A visitor on a parent landing page (for example `/would-you-rather-questions-for-kids`)
  sees only questions from kids' categories, and the page's Play button opens a question from a
  kids' category with no sign-in screen.
- **AC-2** `/categories` lists every category with its name and audience (Kids / Everyone /
  Adults), with kids' categories first.

## Try and first value

- **AC-3** A first-time visitor reaches a playable question from the home page in at most 2 taps,
  without seeing a sign-in, account or email screen.
- **AC-4** When a player taps an option, the app records one vote and shows that question's result
  screen with the player's choice highlighted. If recording fails (offline or server error), the
  result screen still shows the player's choice and the invite text from AC-5, never an error page.
- **AC-5** On the result screen, a question with fewer than `[VOTE_THRESHOLD = 5 / 10 / 20]` votes
  shows the share invite ("New question — send it to someone and see if they pick the same") and
  shows no percentage and no "0". At or above the threshold it shows both options' percentages
  (whole numbers summing to 100) and the total vote count, including the player's own vote exactly
  once. Every number shown comes from recorded votes; no question in the shipped bundle carries a
  vote count.
- **AC-6** Answering a question that this device has already answered does not increase that
  question's total vote count.

## Kids' safety and privacy

- **AC-7** A kids' category never shows a question unless that question is marked as reviewed
  and approved for kids; the build fails if any kids' question lacks that mark. At launch there is
  at least one kids' category with `[30 / 50 / 100]` approved questions.
- **AC-8** A recorded vote contains the question, the choice, the UTC date and a coarse region
  (country and first-level region), and never contains an IP address. A vote in a kids' category
  contains no player ID, and analytics events from kids' categories carry no question, choice or
  stable player identifier, so two answers in kids' categories cannot be linked to the same player.

## Share

- **AC-9** The result screen has a Share button that produces a link to that question. Opening the
  link on another device, with no account, shows that question ready to answer, and the link's
  preview card shows how others answered (or the invite text when below the threshold).
- **AC-10** A friend who opens a shared link sees "Your friend picked {option} — what's yours?"
  before they vote, where {option} is the sharer's choice.

## Pay

- **AC-11** In a paid category, after `[3 / 5]` free questions, the next question is replaced by a
  paywall that shows the price `[$1.99 / $2.99 / $4.99]` and the pack size `[25]`, and asks for no
  account details.
- **AC-12** When payment succeeds, the pack unlocks and the next question shows without a reload.
  When payment fails or is cancelled, the category stays locked, the player sees a message that
  nothing was charged, and they can try again.
- **AC-13** After paying, the player gets a receipt link; opening it on another device unlocks
  the same pack there. (Depends on PRD edit E3.)

## Support and measurement

- **AC-14** Settings has a "Feedback and refunds" link that opens a message addressed to support
  with the app version filled in.
- **AC-15** The app sends these analytics events, none with a name, email or IP:
  `question_answered`, `activated` (fifth answer in one session), `share_clicked`, `share_opened`,
  `paywall_viewed`, `purchase_completed`, `purchase_failed`.
