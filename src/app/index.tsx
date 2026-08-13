import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/store';
import { useColors } from '@/lib/theme';

/** Entry gate: waits for bootstrap, then routes to auth or the app shell. */
export default function Index() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  return status === 'authenticated' ? (
    <Redirect href="/(app)/(tabs)" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
