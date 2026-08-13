import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/api/query-client';
import { ToastHost } from '@/components/ui/toast';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useHydrateTheme } from '@/lib/theme';
import { useHydrateLocale } from '@/lib/i18n';

export function Providers({ children }: { children: ReactNode }) {
  useHydrateTheme();
  useHydrateLocale();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {children}
            {/* Above every screen, so both are visible from anywhere. */}
            <OfflineBanner />
            <ToastHost />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
