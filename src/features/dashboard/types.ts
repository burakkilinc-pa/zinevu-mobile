/**
 * The dashboard, as the app uses it.
 *
 * `GET /portal/dealer/dashboard` returns considerably more than this — a daily
 * series, production and service blocks, revenue and pipeline value. Most of
 * that stays on the desk: the screen answers "what happened today, how is the
 * business trending, and what is waiting for me". So the mapper takes the
 * fields below and drops the rest, rather than modelling a payload the UI will
 * never render. Money in particular is left out on purpose — a phone gets
 * looked at in a customer's garden.
 *
 * The today figures come from the endpoint's `?preset=today` range block, which
 * also carries the equivalent figure for the day before — so every tile can say
 * whether it is a good day without a second request. The fixed-window blocks
 * (this month, last 30 days) ride along on the same response.
 */


/** A figure with the same figure for the preceding, equally long window. */
export type Metric = {
  value: number;
  previous: number;
};

/** One calendar month of the twelve-month series. */
export type MonthPoint = {
  /** `YYYY-MM`, in the portal's timezone. */
  month: string;
  leads: number;
  sent: number;
  won: number;
};

/**
 * The last 30 days as a funnel. The three figures are counted on different
 * timestamps (created / sent / signed), so a deal can sit in one stage and not
 * the one before it — the ratios are a rate of business, not a cohort.
 */
export type Conversion = {
  leads: number;
  offersSent: number;
  won: number;
};

/** Where the last 30 days of leads came from. */
export type LeadSources = {
  meta: number;
  form: number;
  manual: number;
};

export type DashboardSummary = {
  /** Today, in the PORTAL's timezone (Europe/Amsterdam) — not the device's. */
  leadsToday: Metric;
  offersSentToday: Metric;
  /**
   * Form sessions that began today: one per person who opened a funnel, which
   * is the only visitor signal the backend keeps. There is no separate
   * page-view counter, so the screen must not claim one.
   */
  visitorsToday: Metric;
  /** How many of today's visitors left a request. */
  requestsToday: number;
  leadsThisMonth: number;
  wonThisMonth: number;
  /** Twelve calendar months, oldest first, zero-filled by the API. */
  monthly: MonthPoint[];
  /** Lead → offer → signed over the last 30 days. */
  conversion30d: Conversion;
  /** Lead origin over the last 30 days. */
  sources30d: LeadSources;
  generatedAt: string | null;
};

/**
 * Someone in the funnel right now — from the form-session journal, not the chat
 * tables, so it includes the great majority who never open the widget.
 */
export type LiveVisitor = {
  sessionId: string;
  conversationId: string | null;
  hasChat: boolean;
  awaitingReply: boolean;
  /** How far into the form they got, if they started it. */
  stepKey: string | null;
  started: boolean;
  converted: boolean;
  city: string | null;
  countryCode: string | null;
  deviceType: string | null;
  utmSource: string | null;
  lastSeenAt: string | null;
};
