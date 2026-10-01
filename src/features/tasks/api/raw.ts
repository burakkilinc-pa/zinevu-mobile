import type { FollowUpType, VisitBehavior } from '@/features/planning/types';

/**
 * A lead task on the wire, exactly as App\Http\Resources\LeadTaskResource
 * writes it — plus the two mappers that anything reading one needs.
 *
 * This sits apart from either screen because BOTH read the same record: the
 * calendar renders the dated ones as a day's agenda (features/planning) while
 * the queue renders all of them as work to clear (features/tasks). A colour or
 * an address the two parse differently is a bug that looks like the backend
 * being inconsistent, so there is one parser and both call it.
 */

export type RawFollowUpType = {
  name?: string;
  slug?: string;
  color_hex?: string | null;
  icon_key?: string | null;
  behavior?: string;
};

export type RawTaskAddress = {
  formatted?: string | null;
  label?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

export type RawTask = {
  id?: number;
  deal_id?: number | null;
  title?: string | null;
  note?: string | null;
  due_at?: string | null;
  duration_minutes?: number | null;
  status?: string;
  follow_up_type_id?: number | null;
  follow_up_type?: RawFollowUpType | null;
  location_address?: RawTaskAddress | string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  assignee?: { id?: number; name?: string; email?: string } | null;
  on_site_at?: string | null;
  work_started_at?: string | null;
  completed_at?: string | null;
  outcome_tag?: { id?: number; name?: string; color_hex?: string | null } | null;
  attachments?: { id?: number }[];
  lead?: {
    ref?: string;
    customer_name?: string | null;
    offer_no?: string | null;
  } | null;
};

export function mapFollowUpType(raw: RawFollowUpType | null | undefined): FollowUpType | null {
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
export function mapTaskAddress(raw: RawTask['location_address']): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;

  const street = [raw.street, raw.house_number].filter(Boolean).join(' ').trim();
  const place = [raw.postal_code, raw.city].filter(Boolean).join(' ').trim();
  const composed = [street, place].filter(Boolean).join(', ');
  if (composed) return composed;

  return (raw.formatted ?? raw.label ?? null)?.trim() || null;
}
