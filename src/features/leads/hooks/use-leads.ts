import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  activeForms,
  fetchDealerForms,
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
export function useActiveForms(enabled = true) {
  return useQuery({
    queryKey: leadKeys.forms,
    queryFn: fetchDealerForms,
    select: activeForms,
    // A seat without `forms.view` gets a 403 here, and a failed query would read
    // as "this dealer runs no funnels" — so it simply never asks.
    enabled,
    staleTime: 10 * 60_000,
  });
}

/**
 * How one form type is set up — the slug and the option overrides the 3D view
 * of a lead has to be gated on. A lead whose form type the dealer has not
 * configured (and every Meta lead, which has none) falls back to veranda,
 * because that is the flow the configurator mounts for them anyway.
 */
export function useDealerForm(formType: string | null, enabled = true) {
  return useQuery({
    queryKey: leadKeys.forms,
    queryFn: fetchDealerForms,
    enabled,
    staleTime: 10 * 60_000,
    select: (forms) =>
      forms.find((f) => f.formType === formType) ??
      forms.find((f) => f.formType === 'veranda') ??
      null,
  });
}
