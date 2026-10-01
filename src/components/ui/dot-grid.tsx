import { Image, StyleSheet, View } from 'react-native';

import { useColors } from '@/lib/theme';

/**
 * The paper's texture: zinevu.com's dot grid, 1dp dots on a 22dp square.
 *
 * It is the ground the portal's sign-in screens stand on, and the app's
 * background colour was already the same paper (#F7F4ED) — only the dots were
 * missing, which is why the two products looked related rather than identical.
 *
 * A tiled PNG rather than an SVG pattern: react-native-svg is not in this app,
 * and adding a native dependency to draw a dot would mean every dev build on
 * every phone has to be rebuilt. The tile ships at 1x/2x/3x so it stays crisp,
 * and `tintColor` recolours it — the dots are baked black with the 7% in their
 * alpha, so the tint only decides whether they read dark on paper or light on
 * the dark theme's ground.
 *
 * Purely decorative: it sits behind everything, takes no touches, and is hidden
 * from screen readers.
 */
export function DotGrid() {
  const c = useColors();

  return (
    // The wrapper carries pointerEvents — RN's Image does not take the prop,
    // and a decoration must never eat a tap meant for the list over it.
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Image
        source={require('../../../assets/images/dot-grid.png')}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { tintColor: c.ink }]}
      />
    </View>
  );
}
