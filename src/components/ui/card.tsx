import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';
import { PLATE } from '@/components/ui/plate';

/**
 * The single source of truth for card surfaces. Every card in the app should be
 * a `<Card>` (or reuse {@link CARD_CLASS} / {@link CARD_SHADOW}) so radius,
 * border weight, background and elevation are tuned in exactly one place.
 *
 * zinevu.com's surfaces are quiet: a white face on the paper canvas, separated
 * by a hairline. Its shadows are solid offset plates, never blurred, and on the
 * site a card only takes one ON HOVER — it lifts a pixel and lands on a 4px
 * plate under the cursor.
 *
 * A phone has no hover, so the card wears a trace of that plate at rest: the
 * same direction as every other plate in the app, at a fraction of its weight.
 * Enough to lift the card off the paper, far short of saying "press me", which
 * is still the floating button's alone.
 */

/** Card radius / border / background — the class half of the card treatment. */
export const CARD_CLASS = 'rounded-2xl border border-border bg-card';

/**
 * The faintest version of the app's plate. Solid, never blurred, and travelling
 * the same way as the dock's and the floating button's — one light source.
 *
 * Drawn as an iOS shadow rather than as a layer behind the card, unlike the
 * plates on the pill-shaped things. A zero-radius shadow is rasterised without
 * antialiasing, which is visible on a circle at full black and not at 7% on a
 * card's gentle corner — and a layer would mean restructuring every card to
 * carry a sibling.
 */
export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.07,
  shadowRadius: 0,
  shadowOffset: { width: PLATE, height: PLATE },
} as const;

export function Card({
  className,
  style,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View
      className={cn(CARD_CLASS, className)}
      style={[CARD_SHADOW, style]}
      {...props}
    />
  );
}
