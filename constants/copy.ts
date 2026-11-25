export const COPY = {
  dilemmaCount: (n: number) => `${n} DILEMMAS`,
  /** Every grown-up category: the same free count, the rest to unlock (#238). */
  freeBanner: (free: number) =>
    `Every category has ${free} free questions to spark the conversation before you decide`,
  freeMoreHint: (free: number, more: number) => `${free} free · ${more} more`,
  freePill: (free: number) => `${free} FREE`,
  lockedBanner: (free: number, more: number) => `✓ ${free} free dilemmas · 👑 ${more} more to unlock`,
  moreDilemmas: (n: number) => `👑 ${n} MORE DILEMMAS`,
  openNext: (n: number) => `Open the next ${n} questions`,
  restoredNotIncluded: 'Your purchases were restored, but they do not include this upgrade.',
  unlockedTitle: 'Unlocked!',
  unlockedBody: (n: number) => `${n} more dilemmas are now yours to explore.`,
  openNextShort: (n: number) => `OPEN THE NEXT ${n}`,
};
