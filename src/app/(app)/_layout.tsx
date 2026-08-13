import { useEffect, useRef } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { usePush } from '@/features/push/use-push';
import { BiometricGate } from '@/features/auth/components/biometric-gate';
import { useLocale } from '@/lib/i18n';

/**
 * Authenticated shell. A root Stack hosts the tab navigator ((tabs)) plus the
 * full-screen detail routes reached from more than one tab. Keeping those as
 * pushed Stack screens (rather than hidden tabs) means each one covers the dock
 * and is left only via Back, so it always returns to exactly where it was
 * opened from — no stale detail lingering in a hidden tab's own history.
 *
 * App-wide concerns (push registration, the biometric gate) live here so they
 * run for the whole session.
 */
export default function AppLayout() {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const locale = useLocale();

  // Device registration + notification taps live for as long as the shell does.
  usePush();

  // Backend labels are localized via Accept-Language, so refetch everything
  // when the language changes (skip the initial mount).
  const firstLocale = useRef(locale);
  useEffect(() => {
    if (firstLocale.current === locale) return;
    firstLocale.current = locale;
    void queryClient.invalidateQueries();
  }, [locale, queryClient]);

  if (status === 'unauthenticated') return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        {/* The 3D configurator / lead preview WebView — swipe-back disabled so a
            horizontal drag orbits the scene instead of popping the screen. */}
        <Stack.Screen name="web-3d" options={{ gestureEnabled: false }} />
      </Stack>
      <BiometricGate />
    </>
  );
}
