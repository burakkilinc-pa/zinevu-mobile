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
