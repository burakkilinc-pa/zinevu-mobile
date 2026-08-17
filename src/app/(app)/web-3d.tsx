import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { LEAD_3D_IN_KEY } from '@/features/leads/lead-3d';

/**
 * The configurator, full screen.
 *
 * This is how a lead is created on a phone: the dealer walks the real public
 * funnel — same questions, same pricing, same renders the customer would get —
 * rather than a mobile-only form that would have to be kept in step with it.
 *
 * Two things it must get right:
 *
 * The swipe-back gesture is OFF. A horizontal drag in here orbits the 3D scene;
 * if it also popped the screen, the configurator would be unusable. Only the
 * Back control leaves.
 *
 * Leaving invalidates the leads list. The funnel submits inside the WebView, so
 * the app never sees the write — without this the dealer comes back to a list
 * that does not contain the lead they just made, which reads as "it didn't
 * save" and gets entered a second time.
 */
export default function ConfiguratorScreen() {
  const { url, title, handoff } = useLocalSearchParams<{
    url: string;
    title?: string;
    handoff?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const t = useT();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const webview = useRef<WebView>(null);

  function leave() {
    void queryClient.invalidateQueries({ queryKey: ['leads'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    router.back();
  }

  // Viewing an existing lead in 3D. The configurator takes no lead id in its
  // URL — it reads a handoff blob out of sessionStorage — so the blob is
  // written before the page's own scripts run. See lead-3d.ts.
  const injected = handoff
    ? `try{sessionStorage.setItem(${JSON.stringify(LEAD_3D_IN_KEY)},${JSON.stringify(
        String(handoff)
      )})}catch(e){};true;`
    : undefined;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <View className="flex-row items-center gap-1 border-b border-border px-2 py-2">
        <Pressable
          onPress={leave}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('auth.login.back')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text numberOfLines={1} className="flex-1 pr-3 text-base font-semibold text-foreground">
          {title ?? t('leads.new.title')}
        </Text>
        {/* The funnel is several screens long and a mis-tap early on means
            starting over. Reload is the cheapest way back to the first
            question without leaving and re-entering. */}
        <Pressable
          onPress={() => webview.current?.reload()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="refresh" size={19} color={c.foreground} />
        </Pressable>
      </View>

      {url ? (
        <WebView
          ref={webview}
          source={{ uri: String(url) }}
          injectedJavaScriptBeforeContentLoaded={injected}
          onLoadEnd={() => setLoading(false)}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          style={{ flex: 1, backgroundColor: c.background }}
        />
      ) : null}

      {loading ? (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color={c.foreground} />
        </View>
      ) : null}
    </View>
  );
}
