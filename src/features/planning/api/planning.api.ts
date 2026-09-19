import { ApiError, request } from '@/lib/api/client';
import type {
  FollowUpType,
  FollowUpTypeOption,
  NewVisitInput,
  PlanningItem,
  TaskStatus,
  VisitBehavior,
} from '@/features/planning/types';

type RawType = {
  name?: string;
  slug?: string;
  color_hex?: string | null;
  behavior?: string;
};

type RawTypeOption = RawType & {
  id?: number;
  icon_key?: string | null;
  default_duration_minutes?: number | null;
  requires_location?: boolean;
  is_active?: boolean;
};

type RawAddress = {
  formatted?: string | null;
  label?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

type RawEvent = {
  id?: number;
  source?: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  calendar_name?: string | null;
  calendar_color?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  all_day?: boolean;
  is_busy?: boolean;
};

type RawTask = {
  id?: number;
  title?: string | null;
  note?: string | null;
  due_at?: string | null;
  duration_minutes?: number | null;
  status?: string;
  follow_up_type?: RawType | null;
  location_address?: RawAddress | string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  assignee?: { name?: string } | null;
  on_site_at?: string | null;
  work_started_at?: string | null;
  completed_at?: string | null;
  lead?: { ref?: string; customer_name?: string | null } | null;
};

const STATUSES: TaskStatus[] = ['open', 'done', 'cancelled'];

function mapType(raw: RawType | null | undefined): FollowUpType | null {
  if (!raw) return null;

  return {
    name: raw.name ?? '',
    slug: raw.slug ?? '',
    colorHex: raw.color_hex ?? null,
    // The catalogue's own default: a type with no behavior set is a reminder,
    // which is the harmless reading — it puts nothing on a route.
    behavior: (raw.behavior === 'field_visit' ? 'field_visit' : 'reminder') as VisitBehavior,
  };
}

/**
 * The address is stored as a JSON blob once the controller has geocoded it,
 * but older rows hold a plain string. Take whichever shape is there.
 *
 * The blob the portal's own forms write is the FOUR FIELDS, not a `formatted`
 * line — so composing them is the normal path, and `formatted`/`label` are the
 * fallbacks for rows written by something else.
 */
function mapAddress(raw: RawTask['location_address']): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;

  const street = [raw.street, raw.house_number].filter(Boolean).join(' ').trim();
  const place = [raw.postal_code, raw.city].filter(Boolean).join(' ').trim();
  const composed = [street, place].filter(Boolean).join(', ');
  if (composed) return composed;

  return (raw.formatted ?? raw.label ?? null)?.trim() || null;
}

function mapItem(raw: RawTask): PlanningItem {
  return {
    source: 'task',
    id: Number(raw.id ?? 0),
    title: raw.title?.trim() || '',
    note: raw.note?.trim() || null,
    dueAt: raw.due_at ?? null,
    durationMinutes: raw.duration_minutes ?? null,
    status: STATUSES.includes(raw.status as TaskStatus) ? (raw.status as TaskStatus) : 'open',
    type: mapType(raw.follow_up_type),
    locationAddress: mapAddress(raw.location_address),
    customerName: raw.lead?.customer_name ?? raw.contact_name ?? null,
    leadRef: raw.lead?.ref ?? null,
    contactName: raw.contact_name ?? null,
    contactPhone: raw.contact_phone ?? null,
    assigneeName: raw.assignee?.name ?? null,
    onSiteAt: raw.on_site_at ?? null,
    workStartedAt: raw.work_started_at ?? null,
    completedAt: raw.completed_at ?? null,
    calendarName: null,
    calendarColor: null,
    isBusy: true,
    allDay: false,
  };
}

/**
 * A synced calendar block, flattened into the same shape the agenda renders.
 *
 * One shape rather than a union, because everything the grid and the agenda do
 * with an entry — bucket it by day, sort it by clock time, draw a dot in a
 * colour, show a rail and a title — is identical for a montage and for "dentist,
 * 14:00". The `source` field is what the two components branch on for the few
 * places they must differ.
 */
function mapEvent(raw: RawEvent): PlanningItem {
  const startsAt = raw.starts_at ?? null;
  const endsAt = raw.ends_at ?? null;

  // Derived rather than sent: the agenda draws an end time from a duration, and
  // an external event carries an end instant instead.
  const duration =
    startsAt && endsAt
      ? Math.max(0, Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000))
      : null;

  return {
    source: 'event',
    id: Number(raw.id ?? 0),
    title: raw.title?.trim() || '',
    note: raw.description?.trim() || null,
    dueAt: startsAt,
    durationMinutes: duration,
    // An external calendar has no notion of a task being open or done. 'open'
    // is the neutral reading — it keeps the block at full contrast instead of
    // dimming it the way a finished visit is dimmed.
    status: 'open',
    type: null,
    locationAddress: raw.location?.trim() || null,
    customerName: null,
    leadRef: null,
    contactName: null,
    contactPhone: null,
    assigneeName: null,
    onSiteAt: null,
    workStartedAt: null,
    completedAt: null,
    calendarName: raw.calendar_name?.trim() || null,
    calendarColor: raw.calendar_color ?? null,
    isBusy: raw.is_busy !== false,
    allDay: raw.all_day === true,
  };
}

/**
 * Everything scheduled between two dates.
 *
 * Dates are plain Y-m-d and are read in the PORTAL's timezone server-side, not
 * the phone's — so a visit at half past midnight lands on the day the dealer
 * would say it is on, wherever they happen to be standing.
 *
 * Passing a window also asks for completed work, not just open: a month that
 * hides what was finished renders last week as empty.
 */
export async function fetchPlanning(from: string, to: string): Promise<PlanningItem[]> {
  const d = await request<RawTask[]>('/portal/dealer/lead-tasks', {
    params: { date_from: from, date_to: to },
  });

  return (Array.isArray(d) ? d : [])
    .map(mapItem)
    .filter((item) => item.id !== 0 && item.dueAt !== null);
}

/**
 * The dealer's own calendar blocks over the same window — everything the inbound
 * sync pulled from their linked Google calendar, plus anything they typed onto
 * the portal calendar by hand.
 *
 * A separate call from the tasks rather than the portal's month payload: that one
 * is keyed by month and carries slots, jobs and service requests the phone has no
 * screen for, and the grid's window is six weeks, not a month.
 */
export async function fetchCalendarEvents(
  from: string,
  to: string,
  year: number,
  month: number
): Promise<PlanningItem[]> {
  try {
    const d = await request<RawEvent[]>('/portal/dealer/calendar/events', {
      params: { date_from: from, date_to: to },
    });

    return mapEvents(d);
  } catch (error) {
    // The dedicated read is newer than the deployed API. Until it ships, take the
    // same events out of the month payload, which has carried them all along —
    // otherwise a build in front of an older backend shows a dealer none of their
    // synced blocks and no reason why. Only a MISSING route falls back; a 401 or
    // a 500 is a real failure and must surface as one.
    if (!(error instanceof ApiError) || ![404, 405].includes(error.status)) throw error;

    const payload = await request<{ personal_events?: RawEvent[] }>('/portal/dealer/calendar', {
      // Month-keyed, so it covers the grid's own month but not the few
      // neighbouring-month cells in the first and last row. Those fill in the
      // moment the endpoint above exists.
      params: { year, month: month + 1 },
    });

    return mapEvents(payload?.personal_events).filter((event) => {
      const day = event.dueAt!.slice(0, 10);

      return day >= from && day <= to;
    });
  }
}

function mapEvents(raw: RawEvent[] | undefined | null): PlanningItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map(mapEvent)
    .filter((event) => event.id !== 0 && event.dueAt !== null);
}

/**
 * The dealer's own follow-up catalogue — what the "new visit" picker offers.
 *
 * Inactive types come back too (the settings page edits them), so they are
 * dropped here: a picker is not a place to offer something the dealer retired.
 */
export async function fetchFollowUpTypes(): Promise<FollowUpTypeOption[]> {
  const d = await request<RawTypeOption[]>('/portal/dealer/follow-up-types');

  return (Array.isArray(d) ? d : [])
    .map((raw) => {
      const base = mapType(raw);

      return {
        ...(base ?? { name: '', slug: '', colorHex: null, behavior: 'reminder' as VisitBehavior }),
        id: Number(raw.id ?? 0),
        iconKey: raw.icon_key ?? 'circle',
        defaultDurationMinutes: raw.default_duration_minutes ?? null,
        requiresLocation: raw.requires_location === true,
        isActive: raw.is_active !== false,
      };
    })
    .filter((type) => type.id !== 0 && type.isActive);
}

/**
 * Book one. This is the standalone lane of `POST lead-tasks`: no `deal_id`, so
 * the backend requires a contact name instead — which is why the form does too.
 *
 * `due_at` goes out as a naive "Y-m-d H:i" string on purpose. An ISO instant
 * with a Z would be re-read in Europe/Amsterdam and shift the appointment by
 * the offset; the wall-clock time the dealer typed is the thing to preserve.
 */
export async function createVisit(input: NewVisitInput): Promise<number> {
  const address = input.locationAddress;

  const created = await request<{ id?: number }>('/portal/dealer/lead-tasks', {
    method: 'POST',
    body: {
      follow_up_type_id: input.followUpTypeId,
      title: input.title,
      due_at: input.dueAt,
      duration_minutes: input.durationMinutes,
      contact_name: input.contactName,
      contact_phone: input.contactPhone,
      note: input.note,
      location_address: address
        ? {
            street: address.street,
            house_number: address.houseNumber,
            postal_code: address.postalCode,
            city: address.city,
          }
        : null,
    },
  });

  return Number(created?.id ?? 0);
}

/** Anything scheduled but not yet done, from today on — the "what's next" list. */
export async function fetchUpcoming(): Promise<PlanningItem[]> {
  const d = await request<RawTask[]>('/portal/dealer/lead-tasks', {
    params: { status: 'open', scheduled: 1 },
  });

  return (Array.isArray(d) ? d : []).map(mapItem).filter((i) => i.dueAt !== null);
}
