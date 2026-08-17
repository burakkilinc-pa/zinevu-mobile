import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createVisit,
  fetchCalendarEvents,
  fetchFollowUpTypes,
  fetchPlanning,
} from '@/features/planning/api/planning.api';
import { dateKey, dayOf, endOfMonth, minutesOfDay, monthGrid } from '@/features/planning/calendar';
import type { PlanningItem, PlanningLane } from '@/features/planning/types';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const planningKeys = {
  month: (year: number, month: number) => ['planning', 'month', year, month] as const,
  events: (year: number, month: number) => ['planning', 'events', year, month] as const,
  followUpTypes: ['planning', 'follow-up-types'] as const,
};

/**
 * Whether an item belongs in the lane being shown.
 *
 * A synced calendar block is in EVERY lane. It is not Zinevu work and so has no
 * lane of its own, but it is the reason an afternoon is unavailable — filtering
 * it out of "Visits" would let a dealer book a montage over their own dentist
 * appointment while looking straight at the day. The portal's calendar keeps them
 * always-on for the same reason.
 */
function inLane(item: PlanningItem, lane: PlanningLane): boolean {
  if (item.source === 'event') return true;
  if (lane === 'all') return true;
  // A task whose type carries no behavior is a reminder — the catalogue's own
  // default, and the reading that keeps it off the route.
  const isVisit = item.type?.behavior === 'field_visit';

  return lane === 'visits' ? isVisit : !isVisit;
}

/**
 * A month's planning, keyed by day and narrowed to one lane.
 *
 * The window fetched is the whole SIX-WEEK GRID, not the calendar month: the
 * first and last rows show days from the neighbouring months, and leaving those
 * empty would tell the dealer there is nothing on the 31st when there is.
 *
 * The lane filters the FETCHED month rather than the request, so switching lanes
 * is instant and the chip counts are always all three lanes of the same data —
 * a count that arrives a round-trip after the chip it sits in reads as a bug.
 */
export function usePlanningMonth(year: number, month: number, lane: PlanningLane = 'visits') {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, PERMISSIONS.calendarView);

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const from = dateKey(grid[0]);
  const to = dateKey(grid[grid.length - 1]);

  const query = useQuery({
    queryKey: planningKeys.month(year, month),
    queryFn: () => fetchPlanning(from, to),
    enabled: allowed,
    staleTime: 60_000,
  });

  // The dealer's own calendar, side by side with their tasks. Its own query so a
  // dealer who linked nothing pays one empty response, and a sync that is slow or
  // erroring never keeps the visits off the screen.
  const events = useQuery({
    queryKey: planningKeys.events(year, month),
    queryFn: () => fetchCalendarEvents(from, to, year, month),
    enabled: allowed,
    staleTime: 60_000,
  });

  // One pass over the month for all three chips, so the numbers can never
  // disagree with the grid they label.
  //
  // Synced blocks are deliberately NOT counted. The chips count the work in the
  // dealer's own pipeline, and "Visits 6" turning into "Visits 9" because
  // somebody's calendar has three birthdays in it would make the number useless.
  const counts = useMemo(() => {
    const tally = { visits: 0, followups: 0, all: 0 };

    for (const item of query.data ?? []) {
      tally.all += 1;
      if (inLane(item, 'visits')) tally.visits += 1;
      else tally.followups += 1;
    }

    return tally as Record<PlanningLane, number>;
  }, [query.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();

    function push(key: string, item: PlanningItem) {
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }

    for (const item of query.data ?? []) {
      if (!item.dueAt) continue;
      if (!inLane(item, lane)) continue;
      push(dayOf(item.dueAt), item);
    }

    for (const event of events.data ?? []) {
      if (!event.dueAt) continue;
      // A holiday runs Monday to Friday, and the day it STARTS is not the only
      // day it blocks — so a spanning event lands on every day it covers, the
      // way it does in every calendar the dealer already uses.
      for (const key of daysSpanned(event, from, to)) push(key, event);
    }

    // Chronological within a day — a calendar that lists 16:00 above 09:00 is
    // not a calendar. All-day blocks sort to the top, which is where they belong:
    // they frame the day rather than sit at a time in it.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;

        return minutesOfDay(a.dueAt!) - minutesOfDay(b.dueAt!);
      });
    }

    return map;
  }, [query.data, events.data, lane, from, to]);

  return {
    ...query,
    grid,
    byDay,
    counts,
    allowed,
    // A failing task fetch is an error; a failing calendar fetch is not worth
    // blanking the screen for, so only the tasks decide `isError`. Both feed the
    // spinner and the pull-to-refresh, which are about "is something in flight".
    isLoading: query.isLoading || events.isLoading,
    isRefetching: query.isRefetching || events.isRefetching,
    refetch: async () => {
      await Promise.all([query.refetch(), events.refetch()]);
    },
  };
}

/**
 * Every Y-m-d an event covers, clipped to the grid's own window.
 *
 * Clipped because a two-week holiday pulled in from a linked calendar would
 * otherwise loop over days the grid does not draw — harmless but pointless — and
 * because an event that started before the first cell still has to appear on it.
 */
function daysSpanned(event: PlanningItem, from: string, to: string): string[] {
  const start = new Date(event.dueAt!);
  const end =
    event.durationMinutes && event.durationMinutes > 0
      ? new Date(start.getTime() + event.durationMinutes * 60_000)
      : start;

  const days: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  // An end exactly at midnight belongs to the previous day: 09:00–00:00 is one
  // day of work, not two.
  const lastKey = dateKey(
    end.getHours() === 0 && end.getMinutes() === 0 && end.getTime() > start.getTime()
      ? new Date(end.getTime() - 60_000)
      : end
  );

  // Bounded rather than while(true): a corrupt end date should not spin here.
  for (let i = 0; i < 60; i += 1) {
    const key = dateKey(cursor);
    if (key >= from && key <= to) days.push(key);
    if (key >= lastKey) break;
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

/**
 * The dealer's follow-up types, for the "new visit" picker.
 *
 * Cached long: a catalogue somebody edits in settings once a quarter is not
 * worth a round-trip every time the button is pressed.
 */
export function useFollowUpTypes() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: planningKeys.followUpTypes,
    queryFn: fetchFollowUpTypes,
    enabled: hasPermission(user, PERMISSIONS.tasksView),
    staleTime: 10 * 60_000,
  });
}

/**
 * Book a visit.
 *
 * Invalidates every month rather than the one it landed in: the form can put a
 * visit in any month, and recomputing which one is more code than one extra
 * refetch of a screen the dealer is already looking at.
 */
export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVisit,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planning', 'month'] });
    },
  });
}

/** Whether a month is the one the given date is in — used to dim the padding days. */
export function inMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

/** The last day of the month, for the grid's own bookkeeping. */
export { endOfMonth };
