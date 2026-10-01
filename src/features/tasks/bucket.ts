import type { TaskBucket, TaskItem } from '@/features/tasks/types';

/**
 * Which column a task belongs in, by its due date against today.
 *
 * A straight port of the portal board's `bucketOf`, boundaries included, so a
 * task the web calls overdue is overdue here too. The comparison is made in the
 * PHONE's timezone on purpose: "today" has to mean the day the person holding it
 * is living in, and a dealer checking the queue from a holiday in Turkey still
 * wants the Dutch office's Tuesday to read as Tuesday — which it does, because
 * `due_at` is an instant and both sides of this comparison are instants.
 */
export function bucketOf(dueAt: string | null): TaskBucket {
  if (!dueAt) return 'nodate';

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'nodate';

  const today = startOfToday();
  if (due < today) return 'overdue';
  if (due < addDays(today, 1)) return 'today';
  if (due < addDays(today, 2)) return 'tomorrow';
  if (due < addDays(today, 7)) return 'this_week';

  return 'later';
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);

  return d;
}

/**
 * Group tasks into the six buckets, keeping the server's order inside each.
 *
 * The list arrives soonest-due first with the undated sunk to the bottom, so a
 * single pass preserves time order per bucket without re-sorting — and the
 * undated ones land in `nodate` in the order the office created them.
 */
export function groupByBucket(tasks: TaskItem[]): Record<TaskBucket, TaskItem[]> {
  const out: Record<TaskBucket, TaskItem[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    nodate: [],
  };

  for (const task of tasks) out[bucketOf(task.dueAt)].push(task);

  return out;
}
