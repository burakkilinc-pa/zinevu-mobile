import { onlineManager, QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { ApiError } from '@/lib/api/client';

// Queries pause while the device is offline and resume (refetching what went
// stale) the moment connectivity returns, instead of failing one by one.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // Gate only on the hard `isConnected` flag; the `isInternetReachable` probe
    // flaps to false transiently and was pausing queries on a live connection.
    setOnline(state.isConnected !== false);
  })
);

/**
 * Shared TanStack Query client. Mirrors the web frontend defaults
 * (no refetch on focus, short stale time) and avoids retrying auth/validation
 * errors that will never succeed on retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) return false;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
