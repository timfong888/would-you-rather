// Open Graph / Twitter metadata for a question's share page (/p/<id>).
// Pure and shared by scripts/generate-sharing-pages.mjs and the unit tests.
// Kids questions (kf-*) get exactly the same static fields: nothing here reads votes or sets IDs.
import { SITE_NAME } from './site.js';

// Same words as the share message body (SHARE_PROMPT in lib/shareInvite.ts, #229). Short on purpose:
// iMessage/WhatsApp cut longer titles.
export const SHARE_TITLE = 'Which would you pick?';

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Options are written as sentence starts ("Have a pet dragon"); mid-sentence they read
// "Would you rather have ... or have ...?". Keep acronyms ("DNA test") and "I" as written.
export function lowerFirst(text) {
  const word = text.split(' ')[0];
  if (word === 'I' || word.startsWith("I'") || (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word))) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function sharePageMeta(question, origin) {
  const a = truncate(lowerFirst(question.optionA), 80);
  const b = truncate(lowerFirst(question.optionB), 80);
  // The card image already shows both options, so the title is a hook, not the question again (#131).
  // The question as text goes in the description and the image alt (platforms without an image, screen readers).
  const questionText = `Would you rather ${a} or ${b}?`;
  return {
    title: SHARE_TITLE,
    description: questionText,
    imageAlt: questionText,
    url: `${origin}/p/${question.id}`,
    image: `${origin}/api/og?id=${encodeURIComponent(question.id)}`,
    imageWidth: 1200,
    imageHeight: 630,
    siteName: SITE_NAME,
  };
}
