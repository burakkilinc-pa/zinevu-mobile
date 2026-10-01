import { Image, StyleSheet, View } from 'react-native';
import { useColorScheme } from 'nativewind';

/**
 * The paper's texture: zinevu.com's dot grid, 1dp dots on a 22dp square.
 *
 * It is the ground the portal stands on, and the app's background colour was
 * already the same paper (#F7F4ED) — only the dots were missing, which is why
 * the two products looked related rather than identical.
 *
 * A tiled PNG rather than an SVG pattern: react-native-svg is not in this app,
 * and adding a native dependency to draw a dot would mean rebuilding every dev
 * build on every phone. It ships at 1x/2x/3x so it stays crisp.
 *
 * TWO tiles rather than one tinted one. iOS renders a tinted Image as a
 * template, which does not reliably tile with resizeMode="repeat" — and a
 * background that silently fails to draw is a worse trade than two 100-byte
 * files.
 *
 * The dots are DARKER than the site's rgba(0,0,0,0.07), and deliberately. At 7%
 * a dot on this paper is #E6E3DD — a six-percent step in brightness, carried by
 * a mark a third of a millimetre across on a 3x screen. That reads on a desktop
 * canvas and sits under the threshold on a phone held at arm's length: it drew
 * correctly and could not be seen. The 22dp geometry is the site's and stays;
 * only the contrast is a phone's.
 *
 * Purely decorative: it sits behind everything, takes no touches, and is hidden
 * from screen readers.
 */
const TILE = {
  light: require('../../../assets/images/dot-grid.png'),
  dark: require('../../../assets/images/dot-grid-inverse.png'),
};

export function DotGrid() {
  const { colorScheme } = useColorScheme();

  return (
    // The wrapper carries pointerEvents — RN's Image does not take the prop,
    // and a decoration must never eat a tap meant for the content over it.
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      <Image
        source={colorScheme === 'dark' ? TILE.dark : TILE.light}
        resizeMode="repeat"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
