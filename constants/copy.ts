export const COPY = {
  dilemmaCount: (n: number) => `${n} DILEMMAS`,
  /** Every grown-up category: the same free count, the rest to unlock (#238). */
  freeBanner: (free: number) =>
    `Every category has ${free} free questions to spark the conversation before you decide`,
  freeMoreHint: (free: number, more: number) => `${free} free · ${more} more`,
  freePill: (free: number) => `${free} FREE`,
  /** Still used by the category page until the next step replaces it. */
  expansionBanner: (free: number, more: number) =>
    `✓ ${free} free dilemmas · 👑 ${more} more waiting in the expansion pack`,
};
