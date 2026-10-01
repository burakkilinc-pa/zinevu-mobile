import { View } from 'react-native';

import { useColors } from '@/lib/theme';

/**
 * How far a solid plate sits behind the thing standing on it.
 *
 * zinevu.com never blurs a shadow: a floating slab stands on a solid offset
 * plate, and that plate always travels EQUALLY on both axes — `6px 6px` on the
 * site's modals, `4px 4px` on its menus. One light source, one direction.
 *
 * It was 3px down-and-right on the floating button and 2px straight down on the
 * dock, which read exactly as what it was: two different lights in one room.
 * One number now, and every plate takes it on both axes.
 *
 * 3 rather than the site's 6: the same plate at phone scale, where 6dp under a
 * dock already two thirds the width of the screen reads as a drop shadow rather
 * than as a slab with an edge.
 */
export const PLATE = 3;

/** Where the face sits while pressed — into its plate, not off it. */
export const PLATE_PRESSED = 1;

/**
 * The plate itself: a solid layer behind a face, offset down and right.
 *
 * A layer rather than a shadow with its blur set to zero — iOS rasterises that
 * one from the layer's shadow path without antialiasing, which on anything
 * round comes out visibly stepped. Drop it in as the first child of a
 * shrink-wrapping wrapper and it takes the face's exact footprint.
 */
export function Plate({ radius, color }: { radius: number; color?: string }) {
  const c = useColors();

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: radius,
        backgroundColor: color ?? c.ink,
        transform: [{ translateX: PLATE }, { translateY: PLATE }],
      }}
    />
  );
}
