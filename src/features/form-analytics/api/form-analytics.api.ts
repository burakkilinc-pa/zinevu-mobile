import { request } from '@/lib/api/client';
import {
  VISIT_STATUSES,
  type AnalyticsRange,
  type BreakdownRow,
  type FormAnalyticsOverview,
  type FunnelStep,
  type LiveSnapshot,
  type TimelineEvent,
  type Visit,
  type VisitPlace,
  type VisitStatus,
} from '@/features/form-analytics/types';

/**
 * The dealer's funnel analytics — the four reads behind the portal's form
 * analytics page, all under `analytics.view`.
 *
 * Every call takes the same scope the web page sends, so a number on the phone
 * and the one on the desk describe the same visits. Two parameters the web
 * exposes are deliberately never sent: `include_ignored` and `include_bots`.
 * Both default to "leave them out" server-side, and a phone has no business
 * showing a dealer their own test traffic or Meta checking an ad's landing
 * page as if they were customers.
 */

type RawRate = {
  views?: number;
  conversions?: number;
  conversion_rate?: number;
};

type RawGeo = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
};

type RawVisit = {
  session_id?: string;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  duration_ms?: number | null;
  max_step_index?: number | null;
  max_step_key?: string | null;
  device_type?: string | null;
  device_os?: string | null;
  surface?: string | null;
  form_type?: string | null;
  source?: string | null;
  geo?: RawGeo | null;
  lead?: {
    deal_id?: number | null;
    deal_no?: string | null;
    offer_no?: string | null;
    ref?: string | null;
  } | null;
  lead_deleted?: boolean;
  status?: string;
  live_window_seconds?: number | null;
};

type RawOverview = {
  totals?: {
    views?: number;
    visitors?: number;
    starts?: number;
    conversions?: number;
    deleted_conversions?: number;
    abandons?: number;
    start_rate?: number;
    conversion_rate?: number;
    visitor_conversion_rate?: number;
  };
  previous?: {
    views?: number;
    visitors?: number;
    starts?: number;
    conversions?: number;
    conversion_rate?: number;
  } | null;
  forms?: (RawRate & { form_type?: string })[];
  sources?: (RawRate & { source?: string })[];
  devices?: (RawRate & { device?: string })[];
  recent_sessions?: RawVisit[];
  ignored?: { hidden_visits?: number };
  bots?: { hidden_visits?: number };
};

type RawStep = {
  step_index?: number | null;
  step_key?: string | null;
  reached?: number;
  pct_of_first?: number;
  stopped?: number;
  is_conversion?: boolean;
  parts?: { step_key?: string | null; reached?: number; pct_of_first?: number }[];
};

type RawEvent = {
  event?: string;
  step_key?: string | null;
  t_ms?: number | null;
  at?: string | null;
  meta?: {
    field?: unknown;
    value?: unknown;
    reason?: unknown;
    status?: unknown;
  } | null;
};

/** The API's fallback for a backend older than `live_window_seconds`. */
const DEFAULT_LIVE_WINDOW_SECONDS = 90;

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const text = (value: unknown) =>
  typeof value === 'string' && value !== '' ? value : null;

function mapPlace(geo: RawGeo | null | undefined): VisitPlace {
  return {
    city: text(geo?.city),
    region: text(geo?.region),
    // The country name is dropped: the code is what fits on a row, and it is
    // what the web prints next to the city too.
    countryCode: text(geo?.country_code),
  };
}

function mapStatus(raw: unknown, fallback: VisitStatus): VisitStatus {
  // A status this build doesn't know means the API grew a new word; the
  // caller picks the verdict that is least likely to be wrong for its list.
  return VISIT_STATUSES.includes(raw as VisitStatus) ? (raw as VisitStatus) : fallback;
}

/** The API's `{ <key>, views, conversions, conversion_rate }` breakdown rows. */
function mapRate<K extends string>(
  rows: (RawRate & Partial<Record<K, unknown>>)[] | undefined,
  key: K
): BreakdownRow[] {
  return (rows ?? [])
    .map((row) => ({
      key: String(row[key] ?? ''),
      visits: num(row.views),
      conversions: num(row.conversions),
      conversionRate: num(row.conversion_rate),
    }))
    .filter((row) => row.key !== '');
}

/**
 * One visit. `fallbackStatus` differs by list: a recent visit with a status
 * this build can't read is most likely over, a live one is by definition
 * present.
 */
function mapVisit(raw: RawVisit, fallbackStatus: VisitStatus): Visit {
  const lead = raw.lead;

  return {
    sessionId: String(raw.session_id ?? ''),
    firstSeenAt: raw.first_seen_at ?? null,
    lastSeenAt: raw.last_seen_at ?? null,
    durationMs: num(raw.duration_ms),
    maxStepKey: text(raw.max_step_key),
    maxStepIndex: typeof raw.max_step_index === 'number' ? raw.max_step_index : null,
    deviceType: text(raw.device_type),
    deviceOs: text(raw.device_os),
    surface: text(raw.surface) ?? 'flat',
    formType: text(raw.form_type),
    source: text(raw.source) ?? 'direct',
    place: mapPlace(raw.geo),
    lead: lead
      ? {
          ref: text(lead.ref),
          // The same order the web picks its label in: the number a dealer
          // would search for first, the bare id only when there is nothing else.
          label: text(lead.deal_no) ?? text(lead.offer_no) ?? `#${num(lead.deal_id)}`,
        }
      : null,
    leadDeleted: !!raw.lead_deleted,
    status: mapStatus(raw.status, fallbackStatus),
    liveWindowSeconds: num(raw.live_window_seconds) || DEFAULT_LIVE_WINDOW_SECONDS,
  };
}

function rangeParams(range: AnalyticsRange) {
  return { date_from: range.from, date_to: range.to };
}

/**
 * The overview: headline, per-form split, sources, devices and the latest
 * visits, for one period.
 *
 * The heavy one — the server reads the whole window of tracking for it — so
 * it is asked for once per period and kept, not polled.
 *
 * The flat `recent_sessions` list is read rather than the grouped
 * `recent_visitors` the web table uses: a group is a person (an IP) with
 * several visits behind it, and a phone row that opens one of several
 * timelines needs a second level the screen has no room for. One row, one
 * visit, one timeline.
 */
export async function fetchFormAnalytics(range: AnalyticsRange): Promise<FormAnalyticsOverview> {
  const d = await request<RawOverview>('/portal/dealer/forms/analytics', {
    params: rangeParams(range),
  });

  const totals = d.totals ?? {};
  const previous = d.previous;

  return {
    totals: {
      visits: num(totals.views),
      visitors: num(totals.visitors),
      starts: num(totals.starts),
      conversions: num(totals.conversions),
      deletedConversions: num(totals.deleted_conversions),
      abandons: num(totals.abandons),
      startRate: num(totals.start_rate),
      conversionRate: num(totals.conversion_rate),
      visitorConversionRate: num(totals.visitor_conversion_rate),
    },
    previous: previous
      ? {
          visits: num(previous.views),
          visitors: num(previous.visitors),
          starts: num(previous.starts),
          conversions: num(previous.conversions),
          conversionRate: num(previous.conversion_rate),
        }
      : null,
    // Already busiest-first and zero-filled with every form the dealer runs,
    // so a form nobody opened this week is still offered in the picker.
    forms: mapRate(d.forms, 'form_type').map((row) => ({
      formType: row.key,
      visits: row.visits,
      conversions: row.conversions,
      conversionRate: row.conversionRate,
    })),
    sources: mapRate(d.sources, 'source'),
    devices: mapRate(d.devices, 'device'),
    visits: (d.recent_sessions ?? [])
      .map((raw) => mapVisit(raw, 'bounced'))
      .filter((v) => v.sessionId !== ''),
    hiddenBotVisits: num(d.bots?.hidden_visits),
    hiddenIgnoredVisits: num(d.ignored?.hidden_visits),
  };
}

/**
 * ONE form's step drop-off.
 *
 * Always asked per form, even for a dealer who runs only one: the overview
 * carries a blended funnel in that case, but two code paths for one chart is
 * one more place for the phone to disagree with itself. Forms are not
 * comparable to each other — their questions differ — which is why the server
 * refuses to blend several into one chart and why this takes a form type.
 */
export async function fetchFormFunnel(
  range: AnalyticsRange,
  formType: string
): Promise<FunnelStep[]> {
  const d = await request<{ steps?: RawStep[] }>('/portal/dealer/forms/analytics/funnel', {
    params: { ...rangeParams(range), form_type: formType },
  });

  return (d.steps ?? []).map((step) => ({
    key: text(step.step_key),
    index: typeof step.step_index === 'number' ? step.step_index : null,
    reached: num(step.reached),
    pctOfFirst: num(step.pct_of_first),
    stopped: num(step.stopped),
    isConversion: !!step.is_conversion,
    parts: (step.parts ?? []).map((part) => ({
      key: text(part.step_key),
      reached: num(part.reached),
      pctOfFirst: num(part.pct_of_first),
    })),
  }));
}

/**
 * Who is on a form this second. Not date-ranged — "now" is not a period — and
 * cheap by design (one index, no aggregation), which is what makes polling it
 * acceptable.
 */
export async function fetchLiveFormVisitors(): Promise<LiveSnapshot> {
  const d = await request<{
    count?: number;
    window_seconds?: number;
    sessions?: RawVisit[];
  }>('/portal/dealer/forms/analytics/live');

  // The live rows carry no window of their own; the snapshot's is theirs.
  const windowSeconds = num(d.window_seconds) || DEFAULT_LIVE_WINDOW_SECONDS;

  return {
    count: num(d.count),
    visits: (d.sessions ?? [])
      // Everyone here is present by definition, so an unknown word reads as
      // the milder of the two present states.
      .map((raw) => mapVisit({ live_window_seconds: windowSeconds, ...raw }, 'looking'))
      .filter((v) => v.sessionId !== ''),
  };
}

/**
 * One visit's journal, oldest first. The server caps it at 500 events, which
 * is far more than any real visit produces.
 */
export async function fetchSessionTimeline(sessionId: string): Promise<TimelineEvent[]> {
  const rows = await request<RawEvent[]>(
    `/portal/dealer/forms/analytics/sessions/${encodeURIComponent(sessionId)}`
  );

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const meta = row.meta ?? {};
    const value = meta.value;

    return {
      event: String(row.event ?? ''),
      stepKey: text(row.step_key),
      tMs: num(row.t_ms),
      at: row.at ?? null,
      field: text(meta.field),
      // Only scalars are answers. An object here would be a tracker change
      // this build predates, and printing "[object Object]" helps nobody.
      value:
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? value
          : null,
      reason: text(meta.reason),
      errorStatus:
        typeof meta.status === 'number' || typeof meta.status === 'string'
          ? String(meta.status)
          : null,
    };
  });
}
