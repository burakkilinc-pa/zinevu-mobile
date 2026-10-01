import { request } from '@/lib/api/client';
import { mapFollowUpType, mapTaskAddress, type RawTask } from '@/features/tasks/api/raw';
import type {
  CompleteTaskInput,
  TaskItem,
  TaskOutcome,
  TeamMember,
} from '@/features/tasks/types';
import type { TaskStatus } from '@/features/planning/types';

const STATUSES: TaskStatus[] = ['open', 'done', 'cancelled'];

export function mapTask(raw: RawTask): TaskItem {
  const type = mapFollowUpType(raw.follow_up_type);

  return {
    id: Number(raw.id ?? 0),
    title: raw.title?.trim() || '',
    note: raw.note?.trim() || null,
    dueAt: raw.due_at ?? null,
    durationMinutes: raw.duration_minutes ?? null,
    status: STATUSES.includes(raw.status as TaskStatus) ? (raw.status as TaskStatus) : 'open',
    type,
    typeIconKey: raw.follow_up_type?.icon_key ?? null,
    isFieldVisit: type?.behavior === 'field_visit',
    locationAddress: mapTaskAddress(raw.location_address),
    customerName: raw.lead?.customer_name ?? raw.contact_name ?? null,
    leadRef: raw.lead?.ref ?? null,
    offerNo: raw.lead?.offer_no ?? null,
    contactName: raw.contact_name ?? null,
    contactPhone: raw.contact_phone ?? null,
    assignee:
      raw.assignee?.id != null
        ? {
            id: Number(raw.assignee.id),
            // An invited colleague who never set a name is shown by e-mail —
            // an empty chip is worse than a long one.
            name: raw.assignee.name?.trim() || raw.assignee.email?.trim() || '',
          }
        : null,
    onSiteAt: raw.on_site_at ?? null,
    workStartedAt: raw.work_started_at ?? null,
    completedAt: raw.completed_at ?? null,
    outcomeName: raw.outcome_tag?.name?.trim() || null,
    attachmentCount: Array.isArray(raw.attachments) ? raw.attachments.length : 0,
  };
}

/**
 * The team's open work.
 *
 * No parameters at all, which is deliberate and is what the portal's board
 * sends too: with neither `deal_id` nor `date_from` the backend defaults to
 * still-open tasks, newest due first, undated last, capped at 500. Everything
 * the screen filters by — assignee, bucket — is then derived from that one set,
 * so switching a chip is instant and the counts in the chips can never disagree
 * with the list under them.
 *
 * A crew member is pinned to their own assignments server-side regardless of
 * what we ask for, so the same call is safe for a montage seat.
 */
export async function fetchTaskQueue(): Promise<TaskItem[]> {
  const d = await request<RawTask[]>('/portal/dealer/lead-tasks');

  return (Array.isArray(d) ? d : []).map(mapTask).filter((task) => task.id !== 0);
}

/**
 * The dealer's own outcome tags.
 *
 * Inactive ones come back too (the portal's settings page edits them), so they
 * are dropped here — a closing sheet is not a place to offer a tag the dealer
 * retired. The first call per dealer seeds the standard set server-side, so an
 * empty answer means they deleted every one of them, not that they are new.
 */
export async function fetchTaskOutcomes(): Promise<TaskOutcome[]> {
  type Raw = {
    id?: number;
    slug?: string;
    name?: string;
    color_hex?: string | null;
    disposition?: string | null;
    auto_followup?: boolean;
    followup_offset_days?: number | null;
    default_followup_type_id?: number | null;
    is_active?: boolean;
  };

  const d = await request<Raw[]>('/portal/dealer/task-outcomes');

  return (Array.isArray(d) ? d : [])
    .map((raw) => ({
      id: Number(raw.id ?? 0),
      slug: raw.slug ?? '',
      name: raw.name?.trim() || '',
      colorHex: raw.color_hex ?? null,
      disposition: raw.disposition ?? null,
      autoFollowUp: raw.auto_followup === true,
      // Two days is the backend's own fallback; mirroring it keeps the date the
      // sheet shows identical to the one the server would have picked.
      followUpOffsetDays: Number(raw.followup_offset_days ?? 2),
      defaultFollowUpTypeId: raw.default_followup_type_id ?? null,
      isActive: raw.is_active !== false,
    }))
    .filter((outcome) => outcome.id !== 0 && outcome.isActive);
}

/** Colleagues who can own a task — the assignee filter's chips. */
export async function fetchTeam(): Promise<TeamMember[]> {
  type Raw = { id?: number; name?: string; email?: string };

  const d = await request<Raw[]>('/portal/dealer/team');

  return (Array.isArray(d) ? d : [])
    .map((raw) => ({
      id: Number(raw.id ?? 0),
      name: raw.name?.trim() || raw.email?.trim() || '',
    }))
    .filter((member) => member.id !== 0);
}

/**
 * Hand tasks to somebody — or take them off whoever has them.
 *
 * One endpoint for one task and for twenty: `bulk-update` takes an id list, so
 * assigning a single row is the same call with a list of one. A separate PATCH
 * for the single case would be a second code path, a second permission to think
 * about (`tasks.manage` gates this one) and a second place for the two to drift.
 *
 * `null` unassigns. The backend silently skips ids this dealer does not own, so
 * the count that comes back is what actually moved, not what we asked for.
 */
export async function assignTasks(ids: number[], assigneeId: number | null): Promise<number> {
  const d = await request<{ updated_count?: number }>('/portal/dealer/lead-tasks/bulk-update', {
    method: 'POST',
    body: { ids, assigned_to: assigneeId },
  });

  return Number(d?.updated_count ?? 0);
}

/**
 * Close a task by recording what happened.
 *
 * There is no "just mark it done": an `outcome_id` closes the task implicitly
 * server-side, and the outcome is what the dealer's own reporting runs on. The
 * portal has no skip either, and a queue that can close a task without saying
 * why would quietly hollow out their numbers.
 *
 * Returns the chained task's due date when the outcome spawned one, so the
 * confirmation can name it ("booked for Friday") instead of staying silent
 * about work that just appeared on somebody's calendar.
 */
export async function completeTask(input: CompleteTaskInput): Promise<{ chainedDueAt: string | null }> {
  const body: Record<string, unknown> = { outcome_id: input.outcomeId };
  if (input.note) body.outcome_note = input.note;
  if (input.followUp) body.followup = { due_at: input.followUp.dueAt };

  const d = await request<RawTask & { chain_task?: RawTask }>(
    `/portal/dealer/lead-tasks/${input.id}`,
    { method: 'PATCH', body }
  );

  return { chainedDueAt: d?.chain_task?.due_at ?? null };
}
