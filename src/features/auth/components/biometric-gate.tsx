import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/store';
import {
  authenticateBiometric,
  isBiometricEnabled,
} from '@/features/auth/biometric';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';

/**
 * Opt-in Face ID / fingerprint lock over the authenticated app. On launch, if
 * the user enabled it, we cover the app and prompt the OS biometric sheet.
 * There's always a "sign out instead" escape so a failed/unavailable sensor
 * can never trap someone out of the app.
 */
export function BiometricGate() {
  const t = useT();
  const c = useColors();
  const signOut = useAuthStore((s) => s.signOut);
  const [locked, setLocked] = useState(false);

  const unlock = useCallback(async () => {
    const ok = await authenticateBiometric(t('auth.biometric.prompt'));
    if (ok) setLocked(false);
  }, [t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (await isBiometricEnabled()) {
        if (!active) return;
        setLocked(true);
        void unlock();
      }
    })();
    return () => {
      active = false;
    };
  }, [unlock]);

  if (!locked) return null;

  return (
    <View className="absolute inset-0 items-center justify-center gap-8 bg-background px-10">
      <Image
        source={require('../../../../assets/images/splash-icon.png')}
        contentFit="contain"
        style={{ width: 190, height: 54 }}
      />
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Ionicons name="lock-closed" size={28} color={c.foreground} />
      </View>
      <Pressable
        onPress={unlock}
        accessibilityRole="button"
        className="h-12 w-full flex-row items-center justify-center gap-2 rounded-md bg-primary active:opacity-90"
      >
        <Ionicons name="finger-print" size={20} color={c.foreground} />
        <Text className="text-base font-semibold text-primary-foreground">
          {t('auth.biometric.unlock')}
        </Text>
      </Pressable>
      <Pressable onPress={signOut} accessibilityRole="button" hitSlop={8}>
        <Text className="text-sm font-medium text-muted-foreground">
          {t('auth.biometric.signOutInstead')}
        </Text>
      </Pressable>
    </View>
  );
}
