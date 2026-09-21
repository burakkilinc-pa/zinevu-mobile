import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { fetchMemberships, switchCompany } from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/features/auth/store';
import type { Membership } from '@/features/auth/types';
import { disconnectRealtime } from '@/lib/realtime/echo';
import { queryClient } from '@/lib/api/query-client';
import { toast } from '@/components/ui/toast';
import { t } from '@/lib/i18n';

export const companyKeys = {
  memberships: () => ['auth', 'memberships'] as const,
};

/**
 * The companies this person works for.
 *
 * The list itself barely moves — somebody has to be invited, or a company
 * opened — but one number on it does: `waiting`, how many visitors are sitting
 * in the OTHER company's chat. That is the whole reason to look.
 *
 * So the polling is earned rather than assumed. `live` (the switcher, on
 * screen) asks every minute; otherwise it asks every five, and only for
 * someone who actually has a second company. A dealer with one company polls
 * nothing, ever — which is most of them.
 */
export function useMemberships({ enabled = true, live = false } = {}) {
  const status = useAuthStore((s) => s.status);

  return useQuery({
    queryKey: companyKeys.memberships(),
    queryFn: fetchMemberships,
    enabled: enabled && status === 'authenticated',
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (live) return 60_000;
      const rows = query.state.data as Membership[] | undefined;
      return (rows?.length ?? 0) > 1 ? 300_000 : false;
    },
  });
}

/**
 * What the entry points need to draw themselves: whether there is anywhere to
 * switch to, and whether anyone is waiting over there.
 *
 * The count is the sum across every OTHER company, because the row that shows
 * it is one row — the sheet behind it is where the per-company breakdown is.
 */
export function useCompanySummary(): { hasOthers: boolean; elsewhereWaiting: number } {
  const status = useAuthStore((s) => s.status);
  const { data } = useMemberships({ enabled: status === 'authenticated' });

  const rows = data ?? [];

  return {
    hasOthers: rows.length > 1,
    elsewhereWaiting: rows
      .filter((row) => !row.current)
      .reduce((total, row) => total + (row.waiting || 0), 0),
  };
}

/**
 * Moving the whole app into another company — the part with no React in it,
 * so a notification tap can do it too.
 *
 * A switch is not a navigation, it is a new session: the server deletes the
 * token this app was carrying and mints one for the other membership. So
 * everything the old company put in memory has to go with it —
 *
 *  - the query cache, which holds its leads, its chats and its planning,
 *  - the socket, which is subscribed to its channel,
 *
 * — and the app lands on the dashboard rather than wherever it happened to be,
 * because a lead id from the company you just left resolves to nothing in the
 * one you just entered. The web portal does the same thing with a full page
 * load; this is the same idea without the reload.
 *
 * Push needs no attention here: a handset is registered for every company its
 * owner belongs to (see DeviceController on the API side), so the phone was
 * already ringing for both before anybody switched.
 */
export async function performCompanySwitch(membershipId: number): Promise<boolean> {
  try {
    const session = await switchCompany(membershipId);

    disconnectRealtime();
    queryClient.clear();
    await useAuthStore.getState().signInWithSession(session);

    return true;
  } catch {
    // The session that failed to move is still the session that works.
    return false;
  }
}

export function useCompanySwitch() {
  const router = useRouter();
  const [switchingTo, setSwitchingTo] = useState<number | null>(null);

  const switchTo = useCallback(
    async (membership: Pick<Membership, 'id' | 'name'>): Promise<boolean> => {
      if (switchingTo !== null) return false;
      setSwitchingTo(membership.id);

      const moved = await performCompanySwitch(membership.id);
      setSwitchingTo(null);

      if (!moved) {
        toast.error(t('companies.switchFailed'));
        return false;
      }

      // Home, not wherever we were: a lead id from the company just left
      // resolves to nothing in the one just entered.
      router.replace('/');
      toast.success(t('companies.switched', { name: membership.name }));
      return true;
    },
    [router, switchingTo]
  );

  return { switchTo, switchingTo };
}
