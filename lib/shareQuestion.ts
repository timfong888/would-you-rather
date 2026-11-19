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

/**
 * The link a player shares. Kids routes get the bare question link: no link_id or
 * generation, so the shared URL carries nothing that identifies a sharer or a chain
 * of shares (kids rule: no tracking or persisted IDs on kids routes).
 */
export function buildShareLink(o: {
  origin: string;
  questionId: string;
  linkId: string;
  generation: number;
  kids: boolean;
}): string {
  const base = `${o.origin}/p/${o.questionId}`;
  return o.kids ? base : `${base}?link_id=${o.linkId}&gen=${o.generation}`;
}

export interface ShareEvent {
  name: 'share_clicked' | 'visitor_shared_after_link';
  props: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Analytics events a share tap produces. Kids routes produce none.
 * Pure, so the kids rule is unit-tested instead of relying on the screen wiring.
 */
export function shareEvents(o: {
  kids: boolean;
  questionId: string;
  surface: string;
  linkId: string;
  visitorId?: string | null;
  incomingLinkId?: string | null;
  incomingGeneration: number;
}): ShareEvent[] {
  if (o.kids) return [];
  const events: ShareEvent[] = [
    {
      name: 'share_clicked',
      props: { question_id: o.questionId, surface: o.surface, link_id: o.linkId, visitor_id: o.visitorId },
    },
  ];
  if (o.incomingLinkId) {
    events.push({
      name: 'visitor_shared_after_link',
      props: {
        link_id: o.incomingLinkId,
        generation: o.incomingGeneration,
        new_link_id: o.linkId,
        visitor_id: o.visitorId,
      },
    });
  }
  return events;
}
