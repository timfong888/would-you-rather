export const APP_NAME = 'WOULD YOU RATHER';

import { CANONICAL_ORIGIN } from '../lib/site';

// Canonical production origin (single value: lib/site.js). EXPO_PUBLIC_SITE_URL may override it in
// non-production web builds (local browserless checks, previews); production builds must match it
// (generate-sharing-pages.mjs and verify-seo fail otherwise). Share links use this same value.
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN;

export const SEO = {
  defaultTitle: 'Would You Rather? — Spark Real Conversations',
  defaultDescription:
    'Turn any moment into a real conversation. Would You Rather turns boredom into fun, helps parents bond with kids, and sparks the debates people actually remember. 260+ dilemmas across 9 categories, with free questions in every one.',
  twitterHandle: '@wouldyourather',
};

// Minimum votes on a question before real percentages are shown (#65, spec BR-2).
export { VOTE_THRESHOLD } from '../lib/results';
