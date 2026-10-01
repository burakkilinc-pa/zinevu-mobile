import type { FollowUpType, TaskStatus } from '@/features/planning/types';

/**
 * Tasks — the team's work queue, which is the same `lead_tasks` record the
 * calendar draws (features/planning/types.ts documents the record itself and
 * stays its home; this module adds what a QUEUE needs and a calendar does not).
 *
 * The difference between the two screens is the question each answers:
 *
 *  - the calendar  "what is my week shaped like"  → only dated work, by day
 *  - the queue     "what have I not done yet"     → every open task, by urgency,
 *                                                   including the undated ones
 *
 * That last clause is why this exists. A task with no `due_at` is invisible on a
 * calendar by definition, and on this backend an undated task is not an edge
 * case — it is the backlog the office works out of.
 */

/**
 * How urgent, relative to today. The portal's board uses exactly these six
 * columns in this order, so the two screens group a day's work identically.
 */
export type TaskBucket = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'nodate';

export const TASK_BUCKETS: TaskBucket[] = [
  'overdue',
  'today',
  'tomorrow',
  'this_week',
  'later',
  'nodate',
];

/** One task, as the queue renders it. */
export type TaskItem = {
  id: number;
  title: string;
  note: string | null;
  /** Null is the backlog — the queue shows it, the calendar cannot. */
  dueAt: string | null;
  durationMinutes: number | null;
  status: TaskStatus;
  type: FollowUpType | null;
  /**
   * The catalogue row's Lucide icon name, translated for display by
   * features/planning/icons.ts. Carried separately because `FollowUpType` is
   * the calendar's shape, where the colour rail does this job instead.
   */
  typeIconKey: string | null;
  /** Shorthand for `type.behavior === 'field_visit'`, defaulted the safe way. */
  isFieldVisit: boolean;
  locationAddress: string | null;
  customerName: string | null;
  /** Routing key into the leads screens ("m12" / "d34"), when there is one. */
  leadRef: string | null;
  offerNo: string | null;
  contactName: string | null;
  contactPhone: string | null;
  /** Id as well as name: the assignee chips filter on it. */
  assignee: { id: number; name: string } | null;
  onSiteAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  /** What the closer tagged it with, once it is done. */
  outcomeName: string | null;
  attachmentCount: number;
};

/**
 * One of the dealer's own "what happened" tags, which is what closing a task
 * records. The dealer configures these in the portal; the app only reads them.
 *
 * `autoFollowUp` is the one that changes the flow: picking such an outcome also
 * books the next attempt, so the sheet has to say so rather than silently
 * creating work on the dealer's calendar.
 */
export type TaskOutcome = {
  id: number;
  slug: string;
  name: string;
  colorHex: string | null;
  /** 'positive' | 'negative' | anything the dealer configured, or null. */
  disposition: string | null;
  autoFollowUp: boolean;
  /** How many days out the chained task lands when nobody picks a date. */
  followUpOffsetDays: number;
  defaultFollowUpTypeId: number | null;
  isActive: boolean;
};

/** A colleague, for the assignee filter. */
export type TeamMember = {
  id: number;
  name: string;
};

/**
 * Which assignee the queue is narrowed to: `'all'`, `'me'`, or a portal user id
 * as a string. A string throughout because that is what a chip key is, and the
 * two special values have to live in the same slot as the ids.
 */
export type AssigneeFilter = string;

/** What closing a task sends. */
export type CompleteTaskInput = {
  id: number;
  outcomeId: number;
  note: string | null;
  /**
   * Only for an outcome that chains, and only the date.
   *
   * Omitting the payload entirely is valid — the backend then falls back to the
   * outcome's own offset — but the dealer should get to see and move a date
   * that is about to appear on somebody's calendar, so the sheet always sends
   * one. The TYPE is deliberately left out: the server's own fallback chain
   * (the outcome's default, then the closed task's own type) is already the
   * right answer, and sending a guess would override it.
   */
  followUp?: { /** Naive "Y-m-d H:i", read in the portal's timezone. */ dueAt: string } | null;
};
