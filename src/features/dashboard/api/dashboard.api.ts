import { request } from '@/lib/api/client';
import type { DashboardSummary, LiveVisitor, Metric } from '@/features/dashboard/types';

/** Raw shapes from GET /portal/dealer/dashboard (only the parts we read). */
type RawDashboard = {
  generated_at?: string;
  range?: {
    leads?: number;
    leads_prev?: number;
    offers_sent?: number;
    offers_sent_prev?: number;
    form_views?: number;
    form_conversions?: number;
  };
  leads?: {
    this_month?: number;
    last_30d?: number;
    sources_30d?: { meta?: number; form?: number; manual?: number };
  };
  sales?: { won_this_month?: number; sent_30d?: number; won_30d?: number };
  monthly?: { month?: string; leads?: number; sent?: number; won?: number }[];
};

function metric(value: unknown, previous: unknown): Metric {
  return { value: Number(value ?? 0), previous: Number(previous ?? 0) };
}

/**
 * The dashboard.
 *
 * `preset=today` is what makes the range block cover today and yesterday; the
 * fixed-window sections (this month, last 30 days) are on the response
 * regardless of the preset, so this is still one round-trip. The response's
 * action list (the web's "Actie vereist") is deliberately not read — see the
 * dashboard screen.
 *
 * Note the API's "today" is the portal's timezone, not the phone's. That is the
 * right answer even when they disagree: a dealer on holiday abroad still wants
 * the count their colleagues in the office are looking at.
 */
export async function fetchDashboard(): Promise<DashboardSummary> {
  const d = await request<RawDashboard>('/portal/dealer/dashboard', {
    params: { preset: 'today' },
  });

  const r = d.range ?? {};

  return {
    leadsToday: metric(r.leads, r.leads_prev),
    offersSentToday: metric(r.offers_sent, r.offers_sent_prev),
    // The range block carries no previous-window figure for form views, so the
    // tile compares against itself and simply shows no delta.
    visitorsToday: metric(r.form_views, r.form_views),
    requestsToday: Number(r.form_conversions ?? 0),
    leadsThisMonth: Number(d.leads?.this_month ?? 0),
    wonThisMonth: Number(d.sales?.won_this_month ?? 0),
    // Already oldest-first and zero-filled server-side, so a month with no
    // business is a gap in the bars rather than a hole in the axis.
    monthly: (d.monthly ?? []).map((m) => ({
      month: String(m.month ?? ''),
      leads: Number(m.leads ?? 0),
      sent: Number(m.sent ?? 0),
      won: Number(m.won ?? 0),
    })).filter((m) => m.month !== ''),
    conversion30d: {
      leads: Number(d.leads?.last_30d ?? 0),
      offersSent: Number(d.sales?.sent_30d ?? 0),
      won: Number(d.sales?.won_30d ?? 0),
    },
    sources30d: {
      meta: Number(d.leads?.sources_30d?.meta ?? 0),
      form: Number(d.leads?.sources_30d?.form ?? 0),
      manual: Number(d.leads?.sources_30d?.manual ?? 0),
    },
    generatedAt: d.generated_at ?? null,
  };
}

type RawVisitor = {
  session_id?: string;
  conversation_id?: string | null;
  has_chat?: boolean;
  awaiting_reply?: boolean;
  step_key?: string | null;
  started?: boolean;
  converted?: boolean;
  city?: string | null;
  country_code?: string | null;
  device_type?: string | null;
  utm_source?: string | null;
  last_seen_at?: string | null;
};

/** Everyone in the funnel right now — chatting or not. */
export async function fetchLiveVisitors(): Promise<LiveVisitor[]> {
  const d = await request<{ visitors?: RawVisitor[] }>(
    '/portal/dealer/chat/live-visitors'
  );

  return (d.visitors ?? []).map((v) => ({
    sessionId: String(v.session_id ?? ''),
    conversationId: v.conversation_id ?? null,
    hasChat: !!v.has_chat,
    awaitingReply: !!v.awaiting_reply,
    stepKey: v.step_key ?? null,
    started: !!v.started,
    converted: !!v.converted,
    city: v.city ?? null,
    countryCode: v.country_code ?? null,
    deviceType: v.device_type ?? null,
    utmSource: v.utm_source ?? null,
    lastSeenAt: v.last_seen_at ?? null,
  }));
}
