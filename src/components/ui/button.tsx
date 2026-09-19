import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'destructive';

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /**
   * Optional leading icon. On a primary button it sits in the brand's chip —
   * the black rounded square zinevu.com puts on the leading edge of its
   * buttons; elsewhere it is drawn plain, in the label's colour.
   */
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

/**
 * zinevu.com's buttons, for a thumb instead of a pointer.
 *
 * The site's primary is a lime face with a black label, flat at rest; on hover
 * a black mass rises through it and the label turns. A phone has no hover, so
 * the same turn happens while the finger is down: lime → black face with a
 * WHITE label (the portal tried lime-on-black and dropped it), and the chip
 * swaps the other way. Every face carries a 1.5px edge that is only visible
 * when it has to be — on paper and outline faces, and when pressed.
 */
const CONTAINER: Record<Variant, string> = {
  primary: 'border-[1.5px] border-transparent bg-primary',
  secondary: 'border-[1.5px] border-transparent bg-secondary active:opacity-90',
  // The site's `paper` button: a white face on a hairline edge.
  outline: 'border-[1.5px] border-border bg-card active:border-foreground',
  ghost: 'bg-transparent active:bg-muted',
  // Positive confirm: a saturated success green so it clearly reads as the
  // go-ahead, distinct from the brand-coloured primary.
  success: 'bg-success active:opacity-90',
  // The other side of `success`: a solid red for the one action on a screen
  // that cannot be taken back. Solid rather than outlined so it never reads
  // as a secondary way out.
  destructive: 'bg-destructive active:opacity-90',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  success: 'text-white',
  destructive: 'text-destructive-foreground',
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  icon,
  disabled,
  className,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading;
  const turned = variant === 'primary' && pressed;
  const chip = variant === 'primary' && !!icon;

  const contentColor = turned
    ? colors.onInk
    : variant === 'secondary' || variant === 'success' || variant === 'destructive'
      ? colors.white
      : colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      className={cn(
        'h-12 flex-row items-center justify-center gap-2.5 rounded-md',
        chip ? 'pl-2 pr-5' : 'px-6',
        CONTAINER[variant],
        isDisabled && 'opacity-45',
        className
      )}
      style={turned ? { backgroundColor: colors.ink, borderColor: colors.ink } : undefined}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {chip ? (
            <View
              className="h-8 w-8 items-center justify-center rounded-[9px]"
              // The lime face's own ink — black in both schemes. `ink` turns
              // paper in dark mode, where it would swallow the lime icon.
              style={{ backgroundColor: turned ? colors.primary : colors.primaryForeground }}
            >
              <Ionicons
                name={icon}
                size={17}
                color={turned ? colors.primaryForeground : colors.primary}
              />
            </View>
          ) : icon ? (
            <Ionicons name={icon} size={18} color={contentColor} />
          ) : null}
          <Text
            numberOfLines={1}
            className={cn('shrink text-center text-base font-bold', LABEL[variant])}
            style={turned ? { color: colors.onInk } : undefined}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
