/**
 * The message that goes with a shared question (#229). The link unfurls into a card that already
 * shows the question, so the message body is one fixed prompt: it never repeats the question and
 * never says what the sharer picked (the pick travels in the link, see lib/matchShare.ts).
 * The same words are the og:title of the /p/<id> page (SHARE_TITLE in lib/sharePage.js).
 */
export const SHARE_PROMPT = 'Which would you pick?';
