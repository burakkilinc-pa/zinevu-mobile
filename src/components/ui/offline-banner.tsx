import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

import { useT } from '@/lib/i18n';

/**
 * Thin bar under the status bar while the device has no usable connection —
 * the honest explanation for why sends fail and lists stop updating.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        // Only trust the hard `isConnected` signal. NetInfo's `isInternetReachable`
        // probe is null until it resolves and flaps to false transiently (slow DNS,
        // captive-portal checks) even on a working connection — gating on it flashed
        // a bogus "no internet" banner while requests were succeeding.
        setOffline(state.isConnected === false);
      }),
    []
  );

  if (!offline) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}
      className="flex-row items-center justify-center gap-1.5 bg-destructive py-1.5"
    >
      <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      <Text className="text-xs font-medium text-white">
        {t('offline.noConnection')}
      </Text>
    </View>
  );
}
