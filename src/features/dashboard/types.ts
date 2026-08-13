/**
 * The dashboard, as the app uses it.
 *
 * `GET /portal/dealer/dashboard` returns considerably more than this — twelve
 * months of trend, a daily series, production and service blocks, revenue and
 * pipeline value. None of that belongs on a phone: the screen answers "what
 * happened today and what is waiting for me", and everything else is a desk
 * job. So the mapper takes the handful of fields below and drops the rest,
 * rather than modelling a payload the UI will never render.
 *
 * The today figures come from the endpoint's `?preset=today` range block, which
 * also carries the equivalent figure for the day before — so every tile can say
 * whether it is a good day without a second request. The fixed-window blocks
 * (this month, last 30 days) ride along on the same response.
 */

/** Severity the API stamps on an action row; drives its colour. */
export type ActionSeverity = 'critical' | 'warning' | 'info';

export type DashboardAction = {
  /** Stable key — the label is translated client-side (dash.action.*). */
  key: string;
  count: number;
  severity: ActionSeverity;
  /**
   * Portal path the web dashboard links to. Kept because it names the rows the
   * card counted; the app maps it onto its own routes rather than opening a
   * browser. Rows it can't map stay inert instead of lying about where they go.
   */
  href: string | null;
};

/** A figure with the same figure for the preceding, equally long window. */
export type Metric = {
  value: number;
  previous: number;
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
  /** Ordered most-urgent-first; zero-count rows never leave the server. */
  actions: DashboardAction[];
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
