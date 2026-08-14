import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  fetchActiveForms,
  fetchLeadCounts,
  fetchLeads,
} from '@/features/leads/api/leads.api';
import { LEAD_TABS, type BoardCounts, type LeadTab } from '@/features/leads/types';

export const leadKeys = {
  list: (tab: LeadTab) => ['leads', 'list', tab] as const,
  counts: ['leads', 'counts'] as const,
  forms: ['leads', 'active-forms'] as const,
};

/** A tab's board column, paged as the user scrolls. */
export function useLeads(tab: LeadTab) {
  return useInfiniteQuery({
    queryKey: leadKeys.list(tab),
    queryFn: ({ pageParam }) => fetchLeads(tab, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    staleTime: 30_000,
  });
}

const EMPTY_COUNTS = Object.fromEntries(LEAD_TABS.map((t) => [t, 0])) as BoardCounts;

/**
 * The four tab badges.
 *
 * Separate from the list because a badge has to be right for the tabs the user
 * is not looking at, and shares the list's stale time so a pull-to-refresh
 * moves both together.
 */
export function useLeadCounts() {
  const query = useQuery({
    queryKey: leadKeys.counts,
    queryFn: fetchLeadCounts,
    staleTime: 30_000,
  });

  return { counts: query.data ?? EMPTY_COUNTS, refetch: query.refetch };
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
