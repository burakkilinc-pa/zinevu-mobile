import { request } from '@/lib/api/client';
import type {
  FollowUpType,
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

type RawTask = {
  id?: number;
  title?: string | null;
  note?: string | null;
  due_at?: string | null;
  duration_minutes?: number | null;
  status?: string;
  follow_up_type?: RawType | null;
  location_address?: { formatted?: string | null; label?: string | null } | string | null;
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
 */
function mapAddress(raw: RawTask['location_address']): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;

  return (raw.formatted ?? raw.label ?? null)?.trim() || null;
}

function mapItem(raw: RawTask): PlanningItem {
  return {
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

/** Anything scheduled but not yet done, from today on — the "what's next" list. */
export async function fetchUpcoming(): Promise<PlanningItem[]> {
  const d = await request<RawTask[]>('/portal/dealer/lead-tasks', {
    params: { status: 'open', scheduled: 1 },
  });

  return (Array.isArray(d) ? d : []).map(mapItem).filter((i) => i.dueAt !== null);
}
