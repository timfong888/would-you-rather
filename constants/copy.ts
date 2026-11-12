export const COPY = {
  dilemmaCount: (n: number) => `${n} DILEMMAS`,
  freeTrialHint: 'Try free — no commitment, just great conversation',
  freeTrialBanner: 'Try any premium pack free — 3 questions to spark the conversation before you decide',
  expansionHint: (free: number, more: number) => `${free} free · ${more} more in the expansion pack`,
  expansionBanner: (free: number, more: number) =>
    `✓ ${free} free dilemmas · 👑 ${more} more waiting in the expansion pack`,
};
