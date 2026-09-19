/**
 * Form analytics, as the app uses it.
 *
 * The web page (app.veranduo's FormFunnelDashboard) is a desk report: six
 * headline tiles, a daily line chart, per-surface and per-entry tables, a
 * visitor table grouped by IP with a CSV export, and the IP ignore rules. A
 * phone gets the questions a dealer asks between two appointments — how many
 * came, how many sent something, where do they drop off, who is on it right
 * now, and what did that one visit actually do. Everything else stays on the
 * web, so the mappers read the fields below and drop the rest.
 *
 * Every figure is one the API computes. Nothing here re-derives a rate or a
 * status from raw counts, because two places computing "conversion" is how the
 * phone and the portal end up disagreeing about the same week.
 */

/** The windows the screen offers — the same three the web's pills offer. */
export type AnalyticsPeriod = 7 | 30 | 90;

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [7, 30, 90];

/** A period resolved to the `date_from` / `date_to` pair the API takes. */
export type AnalyticsRange = {
  days: AnalyticsPeriod;
  /** `YYYY-MM-DD`, the phone's calendar day. */
  from: string;
  to: string;
};

/**
 * The headline block. Three different things are counted on purpose: people
 * (visitors, one per IP), their visits (views — one person deciding over three
 * evenings is three), and the visits that did something (starts).
 */
export type FormTotals = {
  visits: number;
  visitors: number;
  starts: number;
  /** Requests sent that still exist as a lead. */
  conversions: number;
  /** Sent, then the lead was deleted — no longer in `conversions`. */
  deletedConversions: number;
  /** Every visit without a request, lookers included. */
  abandons: number;
  /** Percent of visits, already rounded server-side (e.g. 71.3). */
  startRate: number;
  /** Requests ÷ visits, in percent. */
  conversionRate: number;
  /** Converting visitors ÷ visitors, in percent — usually the fairer number. */
  visitorConversionRate: number;
};

/** The same figures for the equally long window right before this one. */
export type PreviousTotals = {
  visits: number;
  visitors: number;
  starts: number;
  conversions: number;
  conversionRate: number;
};

/** One of the dealer's forms, with what it saw this period (zero-filled). */
export type FormSplit = {
  formType: string;
  visits: number;
  conversions: number;
  conversionRate: number;
};

/** One row of a sources / devices breakdown. */
export type BreakdownRow = {
  /** The raw bucket: a host or utm_source, or a device type. */
  key: string;
  visits: number;
  conversions: number;
  conversionRate: number;
};

/**
 * What one visit is, as the API words it. `active` and `looking` are only true
 * inside the live window they were judged in — see `decayStatus`.
 */
export type VisitStatus = 'converted' | 'active' | 'looking' | 'abandoned' | 'bounced';

export const VISIT_STATUSES: VisitStatus[] = [
  'converted',
  'active',
  'looking',
  'abandoned',
  'bounced',
];

/** The coarse place behind a visit's IP. The IP itself is not carried. */
export type VisitPlace = {
  city: string | null;
  region: string | null;
  countryCode: string | null;
};

/** The lead a converted visit produced. */
export type VisitLead = {
  /** The unified lead key ("d123") — the same one the lead screens route on. */
  ref: string | null;
  /** Deal number, offer number, or the bare id — whichever the lead has. */
  label: string;
};

export type Visit = {
  sessionId: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  durationMs: number;
  maxStepKey: string | null;
  maxStepIndex: number | null;
  deviceType: string | null;
  deviceOs: string | null;
  /** `flat` (step form) or `3d` (configurator). */
  surface: string;
  formType: string | null;
  /** `direct`, a referring host, or a utm_source. */
  source: string;
  place: VisitPlace;
  lead: VisitLead | null;
  /** Submitted, and the lead it produced has since been deleted. */
  leadDeleted: boolean;
  status: VisitStatus;
  /** How long `active` / `looking` stays true after the last signal. */
  liveWindowSeconds: number;
};

export type FormAnalyticsOverview = {
  totals: FormTotals;
  previous: PreviousTotals | null;
  /** Every form the dealer runs, busiest first — including the silent ones. */
  forms: FormSplit[];
  sources: BreakdownRow[];
  devices: BreakdownRow[];
  /** Up to 50 visits, most recent activity first. */
  visits: Visit[];
  /** Crawler visits the numbers above leave out. */
  hiddenBotVisits: number;
  /** Visits from the dealer's own ignored addresses, also left out. */
  hiddenIgnoredVisits: number;
};

/**
 * The step key of the funnel's closing bar — the request that was actually
 * sent, not a question of any form. Mirrors FormAnalyticsService::STEP_SUBMITTED.
 */
export const STEP_SUBMITTED = '__submitted';

/** One bay of a question asked per part (front side 1, 2, 3). */
export type FunnelStepPart = {
  key: string | null;
  reached: number;
  pctOfFirst: number;
};

export type FunnelStep = {
  key: string | null;
  index: number | null;
  /** Visits that got at least this far. */
  reached: number;
  /** `reached` as a percent of the first step's. */
  pctOfFirst: number;
  /** Visits whose furthest point was this step. */
  stopped: number;
  /** True for the closing bar: the request that was actually sent. */
  isConversion: boolean;
  parts: FunnelStepPart[];
};

/**
 * Who is on a form this second. The rows are ordinary visits — the live
 * payload is the visit list's shape minus the lead — so a live row opens the
 * same timeline a recent one does.
 */
export type LiveSnapshot = {
  count: number;
  visits: Visit[];
};

/** One journal row of a visit, as the tracker recorded it. */
export type TimelineEvent = {
  /** `view`, `step_view`, `option_select`, `error`, … — open-ended. */
  event: string;
  stepKey: string | null;
  /** Milliseconds since the visit began. */
  tMs: number;
  at: string | null;
  /** What was picked, on an option_select. */
  field: string | null;
  value: string | number | boolean | null;
  /** Why it failed, on an error. */
  reason: string | null;
  errorStatus: string | null;
};
