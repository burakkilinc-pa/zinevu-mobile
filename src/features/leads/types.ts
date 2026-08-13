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

/** Which funnel statuses each tab stands for. */
export const TAB_STATUSES: Record<LeadTab, FunnelStatus[]> = {
  new: ['processing', 'needs_review', 'offer_draft'],
  sent: ['offer_sent'],
  approved: ['won'],
  declined: ['lost'],
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

/** Per-status totals for the tab badges. */
export type FunnelCounts = Partial<Record<FunnelStatus, number>>;

export type LeadPage = {
  leads: Lead[];
  counts: FunnelCounts;
  page: number;
  lastPage: number;
  total: number;
};
