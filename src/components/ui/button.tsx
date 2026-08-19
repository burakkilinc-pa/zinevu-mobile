import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'destructive';

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Optional leading icon, rendered before the label in the label's colour. */
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

const CONTAINER: Record<Variant, string> = {
  // Solid ink with white text — the portal's primary button. It inverts to
  // lime-on-ink in dark mode through the token, so no border is needed in
  // either scheme: the fill carries the CTA on its own.
  primary: 'bg-primary active:opacity-90',
  secondary: 'bg-secondary active:opacity-90',
  outline: 'border border-border bg-transparent active:bg-muted',
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
  ...props
}: ButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;
  const contentColor =
    variant === 'secondary' || variant === 'success' || variant === 'destructive'
      ? colors.white
      : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        'h-12 flex-row items-center justify-center gap-2 rounded-md px-5',
        CONTAINER[variant],
        isDisabled && 'opacity-50',
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={contentColor} /> : null}
          <Text
            numberOfLines={1}
            className={cn('shrink text-center text-base font-semibold', LABEL[variant])}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
