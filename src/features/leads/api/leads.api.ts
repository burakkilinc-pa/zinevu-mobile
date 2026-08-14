import { request } from '@/lib/api/client';
import {
  LEAD_TABS,
  TAB_STAGES,
  type BoardCounts,
  type FunnelStatus,
  type Lead,
  type LeadPage,
  type LeadTab,
} from '@/features/leads/types';

type RawLead = {
  ref?: string;
  funnel_status?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  preview_image_url?: string | null;
  total?: number | null;
  offer_no?: string | null;
  created_at?: string | null;
  has_note?: boolean;
  note_excerpt?: string | null;
  related_count?: number;
};

type RawPage = {
  leads?: RawLead[];
  pagination?: { current_page?: number; last_page?: number; total?: number };
};

const STATUSES: FunnelStatus[] = [
  'processing',
  'needs_review',
  'offer_draft',
  'offer_sent',
  'won',
  'lost',
];

function mapLead(raw: RawLead): Lead {
  return {
    ref: String(raw.ref ?? ''),
    // A status this build doesn't know is treated as still-in-progress, which
    // puts it in the "new" tab — the one a dealer actually looks at. Dropping
    // it, or calling it won, would be worse in both directions.
    status: STATUSES.includes(raw.funnel_status as FunnelStatus)
      ? (raw.funnel_status as FunnelStatus)
      : 'offer_draft',
    customerName: raw.customer_name ?? null,
    customerPhone: raw.customer_phone ?? null,
    previewImageUrl: raw.preview_image_url ?? null,
    // Null and zero mean different things here: null is "you may not see
    // money", zero is a free offer. Keep the distinction.
    total: raw.total ?? null,
    offerNo: raw.offer_no ?? null,
    createdAt: raw.created_at ?? null,
    hasNote: !!raw.has_note,
    noteExcerpt: raw.note_excerpt ?? null,
    relatedCount: Number(raw.related_count ?? 0),
  };
}

/**
 * One page of one board column.
 *
 * Reads the same endpoint the web board reads, keyed by the column the tab
 * stands for, so the two views can never disagree about which lane a lead is
 * in. The server paginates the real column — filtering client-side would page
 * over the wrong set and drop rows off the end of a tab silently.
 */
export async function fetchLeads(tab: LeadTab, page: number): Promise<LeadPage> {
  const d = await request<RawPage>('/portal/dealer/leads/board', {
    params: {
      stage: TAB_STAGES[tab],
      page,
      per_page: 20,
    },
  });

  return {
    leads: (d.leads ?? []).map(mapLead).filter((l) => l.ref !== ''),
    page: d.pagination?.current_page ?? page,
    lastPage: d.pagination?.last_page ?? 1,
    total: d.pagination?.total ?? 0,
  };
}

/**
 * The four column totals, for the tab badges.
 *
 * Its own request rather than a number riding along on the list response: the
 * badges have to be right for the three tabs that are NOT open, and a column's
 * own page can only ever count itself. `board/stats` exists for exactly this
 * and returns nothing but the four numbers.
 */
export async function fetchLeadCounts(): Promise<BoardCounts> {
  const d = await request<{ board_stage_counts?: Record<string, number> }>(
    '/portal/dealer/leads/board/stats'
  );

  return Object.fromEntries(
    LEAD_TABS.map((tab) => {
      const n = d.board_stage_counts?.[TAB_STAGES[tab]];

      return [tab, typeof n === 'number' ? n : 0];
    })
  ) as BoardCounts;
}

/** A funnel the dealer has switched on, offered behind the "new lead" button. */
export type ActiveForm = {
  /** form_type plus which of the two funnels it is — unique, and stable. */
  id: string;
  formType: string;
  /** True for the short funnel, false for the full configurator. */
  quick: boolean;
  /** Absolute URL, already resolved to this dealer's own host if they have one. */
  url: string;
};

/** The endpoint keys its forms by form_type rather than returning a list. */
type RawForm = {
  form_type?: string;
  enabled?: boolean;
  public_url?: string | null;
  quick_enabled?: boolean;
  quick_public_url?: string | null;
};

/**
 * The dealer's live funnels.
 *
 * `+` on the leads screen offers these and then opens the chosen one in a
 * WebView, so a lead created on a phone goes through exactly the configurator a
 * customer would use — same questions, same pricing, same renders. There is no
 * second, mobile-only creation path that could drift from it.
 *
 * A form type can expose two funnels: the full configurator and an optional
 * short one. Both are offered when both are on, because they are genuinely
 * different tools — the short one for a phone call, the full one when sitting
 * with the customer.
 */
export async function fetchActiveForms(): Promise<ActiveForm[]> {
  const d = await request<{ forms?: Record<string, RawForm> }>(
    '/portal/dealer/forms'
  );

  const forms: ActiveForm[] = [];

  for (const [formType, raw] of Object.entries(d.forms ?? {})) {
    if (raw.enabled && raw.public_url) {
      forms.push({ id: `${formType}:full`, formType, quick: false, url: raw.public_url });
    }
    if (raw.quick_enabled && raw.quick_public_url) {
      forms.push({ id: `${formType}:quick`, formType, quick: true, url: raw.quick_public_url });
    }
  }

  return forms;
}
