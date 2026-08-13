import { useQuery } from '@tanstack/react-query';

import { fetchDashboard, fetchLiveVisitors } from '@/features/dashboard/api/dashboard.api';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
  visitors: ['dashboard', 'live-visitors'] as const,
};

/**
 * The dashboard figures.
 *
 * Gated on analytics.view because the endpoint itself is: without it the
 * request comes back 403, and a screen that retries a 403 on every focus is
 * just noise. The dock hides the tab for those members anyway; this is the
 * second lock, for a permission revoked while the app was open.
 *
 * The server caches its own answer for two minutes, so refetching on focus
 * costs almost nothing and keeps the numbers honest when the app comes back
 * from the background.
 */
export function useDashboard() {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, PERMISSIONS.analyticsView);

  return useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: fetchDashboard,
    enabled: allowed,
    staleTime: 60_000,
  });
}

/**
 * Who is on the dealer's site this second.
 *
 * Polled rather than pushed: the backend counts anyone seen in the last 75
 * seconds, so a 30-second poll is never more than one beat behind, and it needs
 * no socket to stay open in the background. Only while the query is actually
 * being rendered — react-query stops the interval when the screen unmounts.
 */
export function useLiveVisitors() {
  const user = useAuthStore((s) => s.user);
  const allowed = hasPermission(user, PERMISSIONS.chatView);

  return useQuery({
    queryKey: dashboardKeys.visitors,
    queryFn: fetchLiveVisitors,
    enabled: allowed,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
