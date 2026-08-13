import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/features/auth/store';

export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);

  // Already signed in → bounce to the app shell.
  if (status === 'authenticated') return <Redirect href="/(app)/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
