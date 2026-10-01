import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignTasks,
  completeTask,
  fetchTaskOutcomes,
  fetchTaskQueue,
  fetchTeam,
  searchTasks,
} from '@/features/tasks/api/tasks.api';
import { groupByBucket } from '@/features/tasks/bucket';
import type { AssigneeFilter } from '@/features/tasks/types';
import { useAuthStore } from '@/features/auth/store';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const taskKeys = {
  queue: ['tasks', 'queue'] as const,
  search: (term: string) => ['tasks', 'search', term] as const,
  outcomes: ['tasks', 'outcomes'] as const,
  team: ['tasks', 'team'] as const,
};

/**
 * Below this a term matches half the book. Two is enough for a house number or
 * the start of a street, and short enough that nobody notices the gate.
 */
export const MIN_SEARCH = 2;

/**
 * The work queue: one fetch, grouped into buckets, narrowed by assignee.
 *
 * The assignee filter is applied client-side off that single fetch — the same
 * decision the portal's board made, and for the same reason: the set is the
 * bounded "open follow-ups" list, so filtering locally makes every chip instant
 * and lets each chip carry its own count without a request per chip.
 *
 * Kept short-lived rather than fresh-forever: a queue two people are working
 * out of goes stale the moment a colleague closes something, and the screen is
 * one a dealer leaves open.
 */
export function useTaskQueue(assignee: AssigneeFilter) {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, PERMISSIONS.tasksView);
  const meId = user?.id ?? null;

  const query = useQuery({
    queryKey: taskKeys.queue,
    queryFn: fetchTaskQueue,
    enabled: allowed,
    staleTime: 30_000,
  });

  // Memoised rather than `query.data ?? []`: a fresh literal on every render
  // would re-run both passes below each time, including while the sheet above
  // the list is animating.
  const tasks = useMemo(() => query.data ?? [], [query.data]);

  // Counts over the WHOLE set, not the filtered one — a chip has to say how
  // much is behind it, which is exactly what you cannot see while standing in
  // another chip.
  const counts = useMemo(() => {
    const byAssignee = new Map<number, number>();
    let mine = 0;

    for (const task of tasks) {
      const id = task.assignee?.id;
      if (id == null) continue;
      byAssignee.set(id, (byAssignee.get(id) ?? 0) + 1);
      if (meId !== null && String(id) === meId) mine += 1;
    }

    return { all: tasks.length, mine, byAssignee };
  }, [tasks, meId]);

  const visible = useMemo(() => {
    if (assignee === 'all') return tasks;
    if (assignee === 'me') {
      return meId === null ? [] : tasks.filter((task) => String(task.assignee?.id) === meId);
    }

    return tasks.filter((task) => String(task.assignee?.id) === assignee);
  }, [tasks, assignee, meId]);

  const byBucket = useMemo(() => groupByBucket(visible), [visible]);

  return {
    allowed,
    byBucket,
    counts,
    total: visible.length,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}

/**
 * A lookup across every task, open or finished, whatever its date.
 *
 * Its own query rather than a filter over the queue, because it answers a
 * different question — see searchTasks. The previous answer is kept in place
 * while the next one loads (`keepPreviousData`), so typing one more letter
 * refines a list instead of blanking it to a spinner.
 */
export function useTaskSearch(term: string) {
  const user = useAuthStore((s) => s.user);
  const settled = term.trim();
  const enabled = hasPermission(user, PERMISSIONS.tasksView) && settled.length >= MIN_SEARCH;

  const query = useQuery({
    queryKey: taskKeys.search(settled),
    queryFn: () => searchTasks(settled),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const tasks = useMemo(() => query.data ?? [], [query.data]);

  return {
    byBucket: useMemo(() => groupByBucket(tasks), [tasks]),
    total: tasks.length,
    enabled,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * The assignee filter, remembered for as long as the app is running.
 *
 * Module state rather than a store or the keychain: the preference is worth
 * keeping while someone works through their list and switches to the calendar
 * and back, and is not worth persisting across launches — a filter restored
 * from last week is how a dealer ends up staring at an empty queue convinced
 * the app lost their work. The portal persists it because a browser tab is a
 * long-lived place; a phone screen is not.
 */
let lastAssignee: AssigneeFilter = 'all';

export function useAssigneeFilter() {
  const [assignee, setAssignee] = useState<AssigneeFilter>(lastAssignee);

  return [
    assignee,
    (next: AssigneeFilter) => {
      lastAssignee = next;
      setAssignee(next);
    },
  ] as const;
}

/**
 * Colleagues, for the filter chips.
 *
 * Gated on `tasks.view_all`, which is the permission that actually decides it:
 * without it the backend pins every task read to this user's own assignments,
 * so the chips would be a row of other people's names all reading zero. The
 * endpoint itself only asks for `tasks.view` — this is about what the filter
 * can usefully say, not about what we are allowed to fetch.
 *
 * Cached long: a team changes when somebody is hired.
 */
export function useTaskTeam() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: taskKeys.team,
    queryFn: fetchTeam,
    enabled: hasPermission(user, PERMISSIONS.tasksViewAll),
    staleTime: 5 * 60_000,
  });
}

/** The dealer's outcome tags. Only loaded once the closing sheet opens. */
export function useTaskOutcomes(enabled: boolean) {
  return useQuery({
    queryKey: taskKeys.outcomes,
    queryFn: fetchTaskOutcomes,
    enabled,
    staleTime: 10 * 60_000,
  });
}

/**
 * Close a task.
 *
 * Invalidates the calendar as well as the queue: closing a dated visit changes
 * how that day reads, and a dealer who switches straight back to the month
 * would otherwise see the visit they just finished still standing open.
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.queue });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'month'] });
    },
  });
}

/**
 * Hand tasks over, or take them.
 *
 * Invalidates the calendar too: an assignee's name is on the agenda row, so a
 * visit that just changed hands would otherwise still show the old owner on the
 * tab's other face.
 */
export function useAssignTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, assigneeId }: { ids: number[]; assigneeId: number | null }) =>
      assignTasks(ids, assigneeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.queue });
      void queryClient.invalidateQueries({ queryKey: ['planning', 'month'] });
    },
  });
}

/**
 * Whether this user may hand work to somebody else.
 *
 * `tasks.manage` only — the same gate the endpoint has. A crew seat
 * (`tasks.execute`) can carry out and close what it was given, but deciding who
 * does what is the office's job, and the backend would refuse anyway.
 */
export function useCanAssignTasks(): boolean {
  const user = useAuthStore((s) => s.user);

  return hasPermission(user, PERMISSIONS.tasksManage);
}

/**
 * Whether this user may close a task at all.
 *
 * Either permission does it: `tasks.manage` is the office booking and closing
 * work, `tasks.execute` is the crew carrying it out. Both end up pressing the
 * same button, and the backend accepts both on the same route.
 */
export function useCanCloseTasks(): boolean {
  const user = useAuthStore((s) => s.user);

  return hasAnyPermission(user, [PERMISSIONS.tasksManage, PERMISSIONS.tasksExecute]);
}
