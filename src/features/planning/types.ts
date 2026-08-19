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

/**
 * Which lane the screen is showing.
 *
 * The default is `visits`, and that is the product decision this type exists to
 * carry: a dealer's day is planned around the drives, and a month whose dots are
 * mostly "call back about the voicemail" hides them. Reminders stay one tap
 * away — they are work, just not work that has to be routed.
 */
export type PlanningLane = 'visits' | 'followups' | 'all';

export const PLANNING_LANES: PlanningLane[] = ['visits', 'followups', 'all'];

export type TaskStatus = 'open' | 'done' | 'cancelled';

/** The dealer's own follow-up type: their words, their colour. */
export type FollowUpType = {
  name: string;
  slug: string;
  /** Hex from the dealer's catalogue. Null when they never picked one. */
  colorHex: string | null;
  behavior: VisitBehavior;
};

/**
 * Where an entry on the grid came from.
 *
 *  - `task`   a Zinevu follow-up — a visit or a reminder somebody booked here.
 *  - `event`  a block off the dealer's own calendar: pulled in from the Google
 *             account they linked, subscribed through the ICS feed, or typed
 *             straight onto the portal's calendar. Not Zinevu's work, but it
 *             occupies the same afternoon, so a planning screen that omits it is
 *             telling the dealer a booked day is free.
 */
export type PlanningSource = 'task' | 'event';

export type PlanningItem = {
  /** Ids are unique per source, not across both — key on `${source}${id}`. */
  source: PlanningSource;
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
  /** Calendar-event only: the linked calendar's name ("Werk", "Privé"). */
  calendarName: string | null;
  /** Calendar-event only: that calendar's colour, as the dealer set it. */
  calendarColor: string | null;
  /** Calendar-event only: false on a transparent / free-marked event. */
  isBusy: boolean;
  /** Calendar-event only: an all-day block has no meaningful clock time. */
  allDay: boolean;
};

/**
 * The dealer's catalogue entry as the pickers need it — the same record as
 * `FollowUpType`, plus the bits only a form cares about.
 */
export type FollowUpTypeOption = FollowUpType & {
  id: number;
  iconKey: string;
  /** Pre-fills the visit's block, so "Montage" implies its four hours. */
  defaultDurationMinutes: number | null;
  requiresLocation: boolean;
  isActive: boolean;
};

/**
 * Where to drive to, in the four fields the portal stores.
 *
 * Structured rather than one line because the backend geocodes a Dutch postcode
 * + house number into coordinates, and coordinates are what the route planner
 * on the web side runs on. A single free-text line would book the visit but
 * leave it unroutable.
 */
export type VisitAddress = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
};

/** What the app sends to book a visit or a reminder. */
export type NewVisitInput = {
  followUpTypeId: number;
  title: string;
  /** ISO local ("2026-08-17 11:00"), read in the portal's timezone. */
  dueAt: string;
  durationMinutes: number | null;
  contactName: string | null;
  contactPhone: string | null;
  /** Structured, as the portal stores it — postcode + number get geocoded. */
  locationAddress: VisitAddress | null;
  note: string | null;
};

/** A day, as the month grid needs it: what happened, and how loud to say so. */
export type DayBucket = {
  /** Y-m-d in the portal's timezone. */
  date: string;
  items: PlanningItem[];
};
