import { useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchFormAnalytics,
  fetchLiveFormVisitors,
  fetchSessionTimeline,
} from '@/features/form-analytics/api/form-analytics.api';
import type {
  AnalyticsPeriod,
  AnalyticsRange,
  FormAnalyticsOverview,
  LiveSnapshot,
  Visit,
} from '@/features/form-analytics/types';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const formAnalyticsKeys = {
  all: ['form-analytics'] as const,
  overviews: ['form-analytics', 'overview'] as const,
  overview: (range: AnalyticsRange) =>
    ['form-analytics', 'overview', range.from, range.to] as const,
  live: ['form-analytics', 'live'] as const,
  session: (sessionId: string) => ['form-analytics', 'session', sessionId] as const,
};

/** The web panel's beat — the server counts anyone heard from in the last 90s. */
export const LIVE_POLL_MS = 15_000;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * "Last 30 days" as the API's date pair: today and the 29 days before it, both
 * ends counted — the same arithmetic as the web's date picker, so a period
 * reads the same number on both.
 *
 * The phone's calendar day, not the portal's. The two only differ for a dealer
 * abroad around midnight, and the server stretches `date_to` to the end of its
 * day anyway, so nothing recent falls off the end.
 */
export function resolveRange(days: AnalyticsPeriod, today: Date = new Date()): AnalyticsRange {
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));

  return { days, from: ymd(from), to: ymd(today) };
}

/**
 * Every read here is behind `analytics.view`. The More sheet hides the way in
 * without it; this is the second lock, for a permission revoked while the app
 * was open — a query retrying a 403 on every focus is just noise.
 */
export function useCanViewAnalytics(): boolean {
  const user = useAuthStore((s) => s.user);
  return hasPermission(user, PERMISSIONS.analyticsView);
}

/**
 * The period's overview.
 *
 * Keeps the last period on screen while the next one loads: without it,
 * tapping "90 days" blanks every section for the seconds a 90-day read takes,
 * and the switch you just pressed jumps away under your thumb.
 */
export function useFormAnalytics(range: AnalyticsRange) {
  const allowed = useCanViewAnalytics();

  return useQuery({
    queryKey: formAnalyticsKeys.overview(range),
    queryFn: () => fetchFormAnalytics(range),
    enabled: allowed,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

function isForeground(state: AppStateStatus | null | undefined): boolean {
  // 'unknown' / null happen at startup on Android before the first event;
  // only an explicit background or inactive counts as away.
  return state !== 'background' && state !== 'inactive';
}

/** True while the app is on screen — not backgrounded, not behind a switcher. */
function useAppInForeground(): boolean {
  const [foreground, setForeground] = useState(() => isForeground(AppState.currentState));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(isForeground(state)));
    return () => sub.remove();
  }, []);

  return foreground;
}

/**
 * True while this screen is the one being looked at: focused in the navigator
 * AND the app in the foreground. Navigation focus alone stays true with the
 * phone in a pocket, and a poll that keeps running there is a battery and
 * data cost for a number nobody can see.
 */
export function useScreenVisible(): boolean {
  const focused = useIsFocused();
  const foreground = useAppInForeground();
  return focused && foreground;
}

/**
 * Who is on a form this second, polled every 15s — but only while the screen
 * is visible.
 *
 * Disabled rather than merely un-intervalled when it isn't: a disabled query
 * keeps its last answer for the moment the dealer comes back, and nothing
 * (reconnect, a stray invalidation) can fire it in the background. Coming back
 * refetches straight away, because by then the answer is always stale.
 */
export function useLiveFormVisitors() {
  const allowed = useCanViewAnalytics();
  const visible = useScreenVisible();
  const polling = allowed && visible;

  return useQuery({
    queryKey: formAnalyticsKeys.live,
    queryFn: fetchLiveFormVisitors,
    enabled: polling,
    refetchInterval: polling ? LIVE_POLL_MS : false,
    staleTime: 10_000,
  });
}

/** One visit's journal. Not polled — a pull refreshes a visit still in progress. */
export function useSessionTimeline(sessionId: string) {
  const allowed = useCanViewAnalytics();

  return useQuery({
    queryKey: formAnalyticsKeys.session(sessionId),
    queryFn: () => fetchSessionTimeline(sessionId),
    enabled: allowed && sessionId !== '',
    staleTime: 30_000,
  });
}

/**
 * The visit a timeline belongs to, as the list that opened it already knows
 * it — form, place, device, how far they got.
 *
 * The timeline endpoint returns the journal and nothing about the visit, and
 * there is no endpoint for one visit on its own. Every list that links here
 * (any period's recent visits, the live panel) is in the query cache, so the
 * row is looked up there rather than squeezed through route params. Null when
 * the screen was reached some other way; the timeline still renders.
 */
export function useCachedVisit(sessionId: string): Visit | null {
  const queryClient = useQueryClient();

  return useMemo(() => {
    const live = queryClient.getQueryData<LiveSnapshot>(formAnalyticsKeys.live);
    const fromLive = live?.visits.find((v) => v.sessionId === sessionId);

    for (const [, data] of queryClient.getQueriesData<FormAnalyticsOverview>({
      queryKey: formAnalyticsKeys.overviews,
    })) {
      const hit = data?.visits.find((v) => v.sessionId === sessionId);
      // The overview row carries the lead; the live one only its presence.
      if (hit) return hit;
    }

    return fromLive ?? null;
  }, [queryClient, sessionId]);
}

/**
 * A clock that ticks while `active`, for labels that expire on their own
 * ("filling in now" is only true inside the live window). Same beat as the
 * live poll, so a badge and the count above it never disagree for long.
 */
export function useNow(active: boolean, intervalMs = LIVE_POLL_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
