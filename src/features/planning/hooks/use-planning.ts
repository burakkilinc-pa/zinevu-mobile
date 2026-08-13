import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchPlanning } from '@/features/planning/api/planning.api';
import { dateKey, dayOf, endOfMonth, minutesOfDay, monthGrid } from '@/features/planning/calendar';
import type { PlanningItem } from '@/features/planning/types';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const planningKeys = {
  month: (year: number, month: number) => ['planning', 'month', year, month] as const,
};

/**
 * A month's planning, keyed by day.
 *
 * The window fetched is the whole SIX-WEEK GRID, not the calendar month: the
 * first and last rows show days from the neighbouring months, and leaving those
 * empty would tell the dealer there is nothing on the 31st when there is.
 */
export function usePlanningMonth(year: number, month: number) {
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

  const byDay = useMemo(() => {
    const map = new Map<string, PlanningItem[]>();

    for (const item of query.data ?? []) {
      if (!item.dueAt) continue;
      const key = dayOf(item.dueAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }

    // Chronological within a day — a calendar that lists 16:00 above 09:00 is
    // not a calendar.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => minutesOfDay(a.dueAt!) - minutesOfDay(b.dueAt!));
    }

    return map;
  }, [query.data]);

  return { ...query, grid, byDay, allowed };
}

/** Whether a month is the one the given date is in — used to dim the padding days. */
export function inMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

/** The last day of the month, for the grid's own bookkeeping. */
export { endOfMonth };
