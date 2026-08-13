import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * The single source of truth for card surfaces. Every card in the app should be
 * a `<Card>` (or reuse {@link CARD_CLASS} / {@link CARD_SHADOW}) so radius,
 * border weight, background and elevation are tuned in exactly one place.
 *
 * The look mirrors the web card: a `rounded-2xl` surface with a hairline
 * `border-border/50` edge doing most of the visual lift, plus a deliberately
 * faint shadow — enough to separate the card from the cream background without
 * the heavy drop shadow it used to carry.
 */

/** Card radius / border / background — the class half of the card treatment. */
export const CARD_CLASS = 'rounded-2xl border border-border/50 bg-card';

/** Faint elevation. Kept low on purpose; the border carries the separation. */
export const CARD_SHADOW = {
  shadowColor: '#092632',
  shadowOpacity: 0.04,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
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
