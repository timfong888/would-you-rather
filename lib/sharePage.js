// Open Graph / Twitter metadata for a question's share page (/p/<id>).
// Pure and shared by scripts/generate-sharing-pages.mjs and the unit tests.
// Kids questions (kf-*) get exactly the same static fields: nothing here reads votes or sets IDs.
import { SITE_NAME } from './site.js';

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
  return {
    title: `Would you rather ${a} or ${b}?`,
    description: 'Pick a side, then see if your friend picked the same. Free, no sign-up.',
    url: `${origin}/p/${question.id}`,
    image: `${origin}/api/og?id=${encodeURIComponent(question.id)}`,
    imageWidth: 1200,
    imageHeight: 630,
    siteName: SITE_NAME,
  };
}
