/**
 * Planning: one agenda over everything that puts somebody somewhere at a time.
 *
 * On this backend that is `lead_tasks` — the unified follow-up record, which
 * carries both lanes:
 *
 *  - **field visits**  a measurement, an installation, a service call. Somebody
 *    drives to an address; these are what the day is planned around.
 *  - **reminders**  a call to make, an e-mail to send. No address, no travel.
 *
 * Which lane a task is in comes from its type's `behavior`, configured per
 * dealer — so the app must read it rather than infer it from the type's name.
 */

export type VisitBehavior = 'field_visit' | 'reminder';

export type TaskStatus = 'open' | 'done' | 'cancelled';

/** The dealer's own follow-up type: their words, their colour. */
export type FollowUpType = {
  name: string;
  slug: string;
  /** Hex from the dealer's catalogue. Null when they never picked one. */
  colorHex: string | null;
  behavior: VisitBehavior;
};

export type PlanningItem = {
  id: number;
  title: string;
  note: string | null;
  /** When it is due. Null items are the backlog — never on the calendar. */
  dueAt: string | null;
  /** Field visits carry a window; a reminder is a moment. */
  durationMinutes: number | null;
  status: TaskStatus;
  type: FollowUpType | null;
  /** Where to drive to. Null on reminders and on visits nobody geocoded. */
  locationAddress: string | null;
  /** Who it is for, when the visit hangs off a lead. */
  customerName: string | null;
  /** Routing key back into the leads screen ("m12" / "d34"), when there is one. */
  leadRef: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assigneeName: string | null;
  /** Crew progress between open and done — drives the on-site labels. */
  onSiteAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
};

/** A day, as the month grid needs it: what happened, and how loud to say so. */
export type DayBucket = {
  /** Y-m-d in the portal's timezone. */
  date: string;
  items: PlanningItem[];
};
