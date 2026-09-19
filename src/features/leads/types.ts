/**
 * A lead, as the list renders it.
 *
 * "Lead" and "deal" were never two things on this backend — they are two points
 * on one timeline (see App\Support\LeadFunnelStatus). A Meta submission
 * auto-creates a concept offer; that offer is sent, then signed or rejected. So
 * one list covers the whole funnel and `status` is where on it this row sits.
 */

/** The funnel statuses the API derives. Order is funnel order. */
export type FunnelStatus =
  | 'processing'
  | 'needs_review'
  | 'offer_draft'
  | 'offer_sent'
  | 'won'
  | 'lost';

/**
 * The four tabs the app filters by.
 *
 * Fewer than the six statuses on purpose: `processing` is transient (the
 * mapping engine is still running, measured in seconds) and `needs_review` is a
 * blocked lead — neither is a place a dealer chooses to browse, and both belong
 * with the new arrivals they came in as. So "new" covers everything that has
 * not been sent yet, which is also how a dealer says it.
 */
export type LeadTab = 'new' | 'sent' | 'approved' | 'declined';

export const LEAD_TABS: LeadTab[] = ['new', 'sent', 'approved', 'declined'];

/**
 * The board columns, as the API names them (Dutch — they are stored values).
 *
 * A lead's column is `board_stage`, which is NOT the same thing as its funnel
 * status: the dealer can drag a card, and that placement is persisted. Once
 * they have, the two answers diverge for good.
 */
export type BoardStage = 'nieuw' | 'verzonden' | 'gewonnen' | 'verloren';

/**
 * Which board column each tab is.
 *
 * The tabs filter by column, not by funnel status, so this screen shows what
 * the web board shows — same rows, same counts. Filtering by funnel status
 * instead would silently disagree with the board for every card a dealer has
 * ever moved by hand.
 */
export const TAB_STAGES: Record<LeadTab, BoardStage> = {
  new: 'nieuw',
  sent: 'verzonden',
  approved: 'gewonnen',
  declined: 'verloren',
};

export type Lead = {
  /** Unified routing key: "m{id}" for a Meta lead, "d{id}" for an offer. */
  ref: string;
  status: FunnelStatus;
  customerName: string | null;
  customerPhone: string | null;
  /**
   * A render of the veranda this customer configured — resolved server-side
   * from their answers. Null for a request that carries no configuration (a
   * Meta lead is a name and a phone number).
   */
  previewImageUrl: string | null;
  /** Offer total. Null for a member who may not see money — not zero. */
  total: number | null;
  offerNo: string | null;
  createdAt: string | null;
  /** The customer wrote something themselves — the one part no answer restates. */
  hasNote: boolean;
  noteExcerpt: string | null;
  /** How many other requests the identity matcher tied to this person. */
  relatedCount: number;
};

/** Per-column totals for the tab badges. */
export type BoardCounts = Record<LeadTab, number>;

export type LeadPage = {
  leads: Lead[];
  page: number;
  lastPage: number;
  total: number;
};
