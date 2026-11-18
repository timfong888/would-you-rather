/**
 * Share a link: the native share sheet when there is one, else copy to the clipboard.
 * Pure (everything is injected) so it is testable without a browser. Used by the game
 * screen's share buttons.
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed';

export interface ShareDeps {
  title: string;
  text: string;
  url: string;
  /** `navigator` on web (share / clipboard), undefined elsewhere. */
  nav?: {
    share?: (data: { title: string; text: string; url: string }) => Promise<void>;
    clipboard?: { writeText: (s: string) => Promise<void> };
  };
  /** Legacy copy for pages where the async clipboard is unavailable (e.g. non-secure contexts). */
  legacyCopy?: (s: string) => boolean;
  /** React Native's Share.share, used on native. */
  nativeShare?: (opts: { title: string; message: string; url: string }) => unknown;
}

export async function shareLink(d: ShareDeps): Promise<ShareOutcome> {
  if (d.nativeShare) {
    try {
      await d.nativeShare({ title: d.title, message: `${d.text}\n\n${d.url}`, url: d.url });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  if (d.nav?.share) {
    try {
      await d.nav.share({ title: d.title, text: d.text, url: d.url });
      return 'shared';
    } catch (e) {
      // The player closed the sheet: do not also copy behind their back.
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  if (d.nav?.clipboard) {
    try {
      await d.nav.clipboard.writeText(d.url);
      return 'copied';
    } catch {
      /* fall through to the legacy path */
    }
  }
  try {
    if (d.legacyCopy?.(d.url)) return 'copied';
  } catch {
    /* nothing left to try */
  }
  return 'failed';
}

export const SHARE_FEEDBACK: Record<ShareOutcome, string | null> = {
  shared: null,
  cancelled: null,
  copied: 'Link copied!',
  failed: "Couldn't share. Copy the link from the address bar.",
};
