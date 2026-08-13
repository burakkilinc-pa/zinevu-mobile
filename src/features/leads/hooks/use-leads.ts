import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchActiveForms, fetchLeads } from '@/features/leads/api/leads.api';
import { TAB_STATUSES, type LeadTab } from '@/features/leads/types';

export const leadKeys = {
  list: (tab: LeadTab) => ['leads', 'list', tab] as const,
  forms: ['leads', 'active-forms'] as const,
};

/**
 * A tab's leads, paged as the user scrolls.
 *
 * The counts on the response are dimension-aware — the API returns, for each
 * status, how many rows the OTHER filters would leave — so the tab badges can
 * be read straight off whichever page happened to load. That is also why they
 * are taken from the first page only: every page carries the same totals, and
 * the first one is the one that is always there.
 */
export function useLeads(tab: LeadTab) {
  return useInfiniteQuery({
    queryKey: leadKeys.list(tab),
    queryFn: ({ pageParam }) => fetchLeads(tab, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
}

/** Total across the statuses a tab covers, for its badge. */
export function tabCount(
  counts: Record<string, number | undefined> | undefined,
  tab: LeadTab
): number {
  if (!counts) return 0;

  return TAB_STATUSES[tab].reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

/**
 * The funnels behind the `+` button.
 *
 * Rarely changes and costs a round-trip, so it is fetched once and kept: a
 * dealer switching a form on mid-session is not a case worth polling for, and
 * pull-to-refresh on the list invalidates it anyway.
 */
export function useActiveForms() {
  return useQuery({
    queryKey: leadKeys.forms,
    queryFn: fetchActiveForms,
    staleTime: 10 * 60_000,
  });
}
