import '@/global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { Providers } from '@/components/providers';
import { AnimatedSplash } from '@/components/animated-splash';
import { useAuthStore } from '@/features/auth/store';
import { fontMap, installDefaultFont } from '@/lib/fonts';

SplashScreen.preventAutoHideAsync();
// Make the brand sans the default for every Text before the first render.
installDefaultFont();

export default function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const [fontsLoaded] = useFonts(fontMap);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Providers>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        {/* zinevumobile://magic?token=… — support signing this phone in as a
            dealer member. Outside both groups: it must be reachable whether or
            not somebody is already signed in. */}
        <Stack.Screen name="magic" />
        <Stack.Screen name="(app)" />
      </Stack>
      {!splashDone ? (
        <AnimatedSplash
          ready={status !== 'loading' && fontsLoaded}
          // Hand off from the OS splash only once our overlay is on screen, so
          // there's no flash of the app between the two.
          onLayoutReady={() => void SplashScreen.hideAsync()}
          onFinish={() => setSplashDone(true)}
        />
      ) : null}
    </Providers>
  );
}
