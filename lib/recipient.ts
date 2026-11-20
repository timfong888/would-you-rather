/**
 * Someone who opened a shared link (#134). Pure helpers for the recipient flow on the game
 * screen: the intro line, "they picked …", and the funnel events.
 *
 * Funnel (adult items only): shared_link_opened (AnalyticsContext, on arrival with a link_id)
 * → shared_link_answered → shared_link_play_another / shared_link_send_back / app_cta_click.
 * Kids & Family items send nothing (kids rule: no analytics, no IDs). No pick value is sent.
 */
import type { Friend, MatchOutcome } from './matchShare';
import { uiText } from './matchShare';

export type RecipientAction = 'answered' | 'play_another' | 'send_back' | 'app_cta_click';

export interface RecipientEvent {
  name: 'shared_link_answered' | 'shared_link_play_another' | 'shared_link_send_back' | 'app_cta_click';
  props: Record<string, string | number | boolean | null | undefined>;
}

const EVENT_NAME: Record<RecipientAction, RecipientEvent['name']> = {
  answered: 'shared_link_answered',
  play_another: 'shared_link_play_another',
  send_back: 'shared_link_send_back',
  app_cta_click: 'app_cta_click',
};

export function recipientEvents(
  action: RecipientAction,
  o: {
    kids: boolean;
    questionId: string;
    category?: string;
    linkId?: string | null;
    generation?: number;
    visitorId?: string | null;
    friend: Friend | null;
    outcome?: MatchOutcome | null;
    surface?: string;
  },
): RecipientEvent[] {
  if (o.kids) return [];
  return [
    {
      name: EVENT_NAME[action],
      props: {
        source: 'shared_link',
        question_id: o.questionId,
        category: o.category,
        link_id: o.linkId ?? undefined,
        generation: o.generation,
        visitor_id: o.visitorId,
        // Whether the link carried the sender's pick; never the pick itself.
        friend_pick_in_link: o.friend === 'A' || o.friend === 'B',
        matched: o.outcome ? o.outcome === 'matched' : undefined,
        surface: o.surface,
      },
    },
  ];
}

/** The line above the options for someone who arrived from a share link. */
export function recipientIntro(kids: boolean, friend: Friend | null): string {
  if (friend === 'A' || friend === 'B') return uiText(kids, 'recipient_intro_pick');
  if (friend === 'ask') return uiText(kids, 'recipient_intro_ask');
  return uiText(kids, 'recipient_intro_plain');
}

/** "They picked: <option text>", once the recipient has answered. */
export function theyPickedLine(kids: boolean, optionText: string): string {
  return uiText(kids, 'recipient_they_picked').replace('{option}', optionText);
}
