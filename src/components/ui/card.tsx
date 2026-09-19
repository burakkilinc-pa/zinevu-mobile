import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * The single source of truth for card surfaces. Every card in the app should be
 * a `<Card>` (or reuse {@link CARD_CLASS} / {@link CARD_SHADOW}) so radius,
 * border weight, background and elevation are tuned in exactly one place.
 *
 * zinevu.com's surfaces are flat and quiet at rest: a white face on the paper
 * canvas, separated by a hairline and nothing else. Its shadows are solid
 * offset plates, never blurred — and a plate belongs to something you press,
 * not to a card you read — so a card carries no shadow at all.
 */

/** Card radius / border / background — the class half of the card treatment. */
export const CARD_CLASS = 'rounded-2xl border border-border bg-card';

/** Deliberately empty: flat at rest. Kept so existing spreads stay valid. */
export const CARD_SHADOW = {} as const;

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
