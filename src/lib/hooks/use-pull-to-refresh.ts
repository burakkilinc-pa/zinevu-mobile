import { useCallback, useState } from 'react';

/**
 * Drives a `<RefreshControl>` from a user's pull gesture ONLY.
 *
 * Binding `refreshing` straight to React Query's `isRefetching` is a trap: that
 * flag also flips true for automatic background refetches (on mount/focus, on a
 * realtime event, on reconnect). Programmatically showing the native iOS
 * RefreshControl then leaves its spinner stuck on screen across a navigation
 * transition — e.g. opening a detail screen and coming back leaves a frozen
 * spinner at the top of the list until the user pulls to refresh manually.
 *
 * This keeps the spinner tied to an actual pull, while background refetches keep
 * updating the data silently.
 *
 * @param refetch  the query's `refetch` (its promise is awaited)
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
