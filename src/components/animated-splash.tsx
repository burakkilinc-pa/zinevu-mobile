import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const NAVY = '#082D36'; // brand ink — matches the native splash background
const ICON = require('../../assets/images/icon.png');

/**
 * In-app launch animation that continues seamlessly from the native splash
 * (same ink background + Zinevu mark, so there's no visual jump when the OS
 * splash hands off). Once the app is `ready`, the emblem gives a gentle zoom
 * while the whole overlay dissolves to reveal the app underneath.
 *
 * Uses the RN Animated API (not reanimated) so it needs no worklet/babel setup
 * and matches the animation approach already used elsewhere in the app.
 */
export function AnimatedSplash({
  ready,
  onLayoutReady,
  onFinish,
}: {
  /** True once bootstrap is done — gates the exit so we never dissolve early. */
  ready: boolean;
  /** Fires when the overlay is laid out, so the caller can hide the OS splash. */
  onLayoutReady: () => void;
  onFinish: () => void;
}) {
  // Start already visible (matching the native splash) — no re-fade-in flash.
  const scale = useRef(new Animated.Value(1)).current;
  const overlay = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    Animated.sequence([
      Animated.delay(350),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(overlay, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [ready, scale, overlay, onFinish]);

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayoutReady}
      style={[StyleSheet.absoluteFill, styles.bg, { opacity: overlay }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={ICON} style={styles.logo} contentFit="contain" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 150 },
});
