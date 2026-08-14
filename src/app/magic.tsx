import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store';
import { loginWithMagicToken } from '@/features/auth/api/auth.api';

/**
 * Deep-link sign-in: `zinevumobile://magic?token=…`.
 *
 * Zinevu support mints the token from the admin panel (dealer detail → log in
 * as → mobile) and opens the link on the phone. Whoever is signed in here is
 * signed out FIRST — pushes revoked, server token deleted — because the point
 * of this screen is to land on someone else's account, and a half-swapped
 * session (new bearer, old cached user) is how you end up debugging the wrong
 * dealer.
 *
 * The token is one-time and lives 15 minutes, so this must run exactly once:
 * React 18 mounts effects twice in dev, and a second run would spend a token
 * that is already gone and show "expired" over a perfectly good session.
 */
export default function MagicScreen() {
  const t = useT();
  const c = useColors();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const signOut = useAuthStore((s) => s.signOut);
  const signInWithSession = useAuthStore((s) => s.signInWithSession);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      if (!token) {
        setError(t('auth.magic.invalid'));
        return;
      }
      try {
        // Best-effort: an expired session here must not block the new one.
        if (useAuthStore.getState().status === 'authenticated') {
          await signOut();
        }
      } catch {
        // ignored — the store clears the local token either way
      }
      try {
        const session = await loginWithMagicToken(token);
        await signInWithSession(session);
        router.replace('/(app)/(tabs)');
      } catch (err) {
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : t('auth.magic.invalid')
        );
      }
    })();
  }, [token, signOut, signInWithSession, t]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4">
        {error ? (
          <>
            <Text className="text-center text-lg font-semibold text-foreground">
              {t('auth.magic.failedTitle')}
            </Text>
            <Text className="text-center text-sm text-muted-foreground">{error}</Text>
            <Button
              title={t('auth.magic.backToLogin')}
              onPress={() => router.replace('/(auth)/login')}
            />
          </>
        ) : (
          <>
            <ActivityIndicator color={c.foreground} />
            <Text className="text-base font-medium text-foreground">
              {t('auth.magic.signingIn')}
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}
