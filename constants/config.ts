export const APP_NAME = 'WOULD YOU RATHER';

import { CANONICAL_ORIGIN } from '../lib/site';

// Canonical production origin (single value: lib/site.js). EXPO_PUBLIC_SITE_URL may override it
// for the web build only; share links always use CANONICAL_ORIGIN (see lib/analytics buildShareUrl).
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN;

export const SEO = {
  defaultTitle: 'Would You Rather? — Spark Real Conversations',
  defaultDescription:
    'Turn any moment into a real conversation. Would You Rather turns boredom into fun, helps parents bond with kids, and sparks the debates people actually remember. 260+ dilemmas across 9 categories, with expansion packs for the ones you love.',
  twitterHandle: '@wouldyourather',
};

// Minimum votes on a question before real percentages are shown (#65, spec BR-2).
export { VOTE_THRESHOLD } from '../lib/results';
