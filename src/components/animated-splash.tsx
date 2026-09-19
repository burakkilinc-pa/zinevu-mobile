import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, useWindowDimensions } from 'react-native';
import LottieView from 'lottie-react-native';

const BLACK = '#000000'; // matches the native splash background
const ANIMATION = require('../../assets/animations/zinevu-splash.json');

/**
 * In-app launch animation that continues seamlessly from the native splash
 * (same black background, so there's no visual jump when the OS splash hands
 * off). The Lottie mark — the same animation the website plays — runs once on
 * a square canvas centred on screen; when both it and bootstrap are done, the
 * overlay dissolves to reveal the app underneath.
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
  const { width, height } = useWindowDimensions();
  // The source composition is square (400×400); keep it square and comfortably
  // inside the shorter screen edge so it never crops on small phones.
  const size = Math.min(width * 0.7, height * 0.5);

  // Start already visible (matching the native splash) — no re-fade-in flash.
  const overlay = useRef(new Animated.Value(1)).current;
  const started = useRef(false);
  const [played, setPlayed] = useState(false);

  const handleFinish = useCallback(() => setPlayed(true), []);

  // Safety net: with "reduce motion" on, Lottie can skip straight to the last
  // frame without ever calling onAnimationFinish — never trap the user here.
  useEffect(() => {
    const t = setTimeout(handleFinish, 4000);
    return () => clearTimeout(t);
  }, [handleFinish]);

  useEffect(() => {
    if (!ready || !played || started.current) return;
    started.current = true;
    Animated.timing(overlay, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [ready, played, overlay, onFinish]);

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayoutReady}
      style={[StyleSheet.absoluteFill, styles.bg, { opacity: overlay }]}
    >
      <LottieView
        source={ANIMATION}
        autoPlay
        loop={false}
        onAnimationFinish={handleFinish}
        // lottie-ios parses more strictly than lottie-web — a malformed layer
        // renders nothing at all, so surface it instead of showing black.
        onAnimationFailure={(error) => {
          console.warn('[splash] lottie failed', error);
          handleFinish();
        }}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: BLACK, alignItems: 'center', justifyContent: 'center' },
});
