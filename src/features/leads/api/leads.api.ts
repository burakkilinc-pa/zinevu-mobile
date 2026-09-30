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

/** board/overview: every column's first page in one response, keyed by stage. */
type RawOverview = {
  columns?: Record<string, RawPage | null>;
  total?: number;
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

/** What one search turned up, and how much of it fitted in the answer. */
export type LeadSearchResult = {
  leads: Lead[];
  /** Everything the query matched across all four columns, before the cut. */
  total: number;
};

/**
 * How many of each column's matches one search asks for — so at most four
 * times this many rows come back. Kept modest because every row is a full board
 * card: a term specific enough to be useful returns a handful, and a term that
 * would return hundreds is better answered with "narrow it down" than with a
 * megabyte over a phone connection.
 */
const SEARCH_PER_COLUMN = 25;

/**
 * Find a request by who it is from — name, phone, e-mail, street, postcode,
 * reference or offer number, or anything they answered in the funnel.
 *
 * Reads `board/overview`, which returns every column's first page in ONE
 * request, so a search spans the whole funnel rather than the column the user
 * happens to be looking at: someone typing a phone number wants that person's
 * request, and does not know — or care — whether it was already sent. The
 * matching itself is the server's (App\Http\Controllers\Portal\LeadController
 * ::applySearch), so the phone and the portal agree on what a term matches.
 *
 * Deliberately not paged: this is a lookup, not a board. The four columns' first
 * pages are merged newest-first and `total` says how many matched in all, so a
 * term too broad to answer can say so instead of pretending to scroll forever.
 */
export async function searchLeads(query: string): Promise<LeadSearchResult> {
  const d = await request<RawOverview>('/portal/dealer/leads/board/overview', {
    params: { q: query, per_page: SEARCH_PER_COLUMN },
  });

  const leads = Object.values(d.columns ?? {})
    .flatMap((column) => column?.leads ?? [])
    .map(mapLead)
    .filter((l) => l.ref !== '')
    // One list out of four columns, so it has to be re-sorted: the columns
    // arrive in board order (new, sent, won, lost) and each is sorted only
    // within itself. Newest first is the order every other list here uses.
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));

  return { leads, total: d.total ?? leads.length };
}

/** Sortable instant, with unknown dates last rather than first. */
function timestamp(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);

  return Number.isNaN(ms) ? 0 : ms;
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

/**
 * One form type as the dealer has it set up.
 *
 * More than the `+` button needs, because the 3D view of an existing lead is
 * gated on the same per-dealer configuration the public funnel is: the slug
 * (which the cut-list reads production settings from) and the option overrides
 * (disabled options, custom colours, tightened bounds). Opening a lead in 3D
 * without them would draw a range this dealer does not sell.
 */
export type DealerForm = {
  formType: string;
  enabled: boolean;
  publicUrl: string | null;
  quickEnabled: boolean;
  quickPublicUrl: string | null;
  slug: string | null;
  optionOverrides: Record<string, unknown>;
};

/** The endpoint keys its forms by form_type rather than returning a list. */
type RawForm = {
  form_type?: string;
  enabled?: boolean;
  public_url?: string | null;
  quick_enabled?: boolean;
  quick_public_url?: string | null;
  slug?: string | null;
  option_overrides?: unknown;
};

/**
 * The dealer's funnels, as configured.
 *
 * Fetched once and read two ways — the `+` sheet wants the live ones as links
 * (see `activeForms`), the 3D view wants the configuration behind a form type.
 * One endpoint, one cache entry, so the two can never disagree.
 */
export async function fetchDealerForms(): Promise<DealerForm[]> {
  const d = await request<{ forms?: Record<string, RawForm> }>('/portal/dealer/forms');

  return Object.entries(d.forms ?? {}).map(([formType, raw]) => ({
    formType,
    enabled: !!raw.enabled,
    publicUrl: raw.public_url ?? null,
    quickEnabled: !!raw.quick_enabled,
    quickPublicUrl: raw.quick_public_url ?? null,
    slug: raw.slug ?? null,
    // The API sends `{}` for "never touched"; a JSON array would mean the same
    // thing but is not an override map, so it is not treated as one.
    optionOverrides:
      raw.option_overrides && typeof raw.option_overrides === 'object' && !Array.isArray(raw.option_overrides)
        ? (raw.option_overrides as Record<string, unknown>)
        : {},
  }));
}

/**
 * The funnels a dealer can start a lead from.
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
export function activeForms(forms: DealerForm[]): ActiveForm[] {
  const out: ActiveForm[] = [];

  for (const form of forms) {
    if (form.enabled && form.publicUrl) {
      out.push({ id: `${form.formType}:full`, formType: form.formType, quick: false, url: form.publicUrl });
    }
    if (form.quickEnabled && form.quickPublicUrl) {
      out.push({ id: `${form.formType}:quick`, formType: form.formType, quick: true, url: form.quickPublicUrl });
    }
  }

  return out;
}
