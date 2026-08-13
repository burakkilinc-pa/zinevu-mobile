import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'success';

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Optional leading icon, rendered before the label in the label's colour. */
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

const CONTAINER: Record<Variant, string> = {
  // Mint fill + an ink hairline, mirroring the web primary (`border-black
  // bg-brand-mint`): the pale mint needs the dark edge to read as a solid CTA
  // rather than dissolving into the cream background.
  primary: 'border border-foreground bg-primary active:opacity-90',
  secondary: 'bg-secondary active:opacity-90',
  outline: 'border border-border bg-transparent active:bg-muted',
  ghost: 'bg-transparent active:bg-muted',
  // Positive confirm (Accept offer): a saturated success green so it clearly
  // reads as the go-ahead, distinct from the pale mint primary.
  success: 'bg-success active:opacity-90',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-primary-foreground',
  secondary: 'text-secondary-foreground',
  outline: 'text-foreground',
  ghost: 'text-foreground',
  success: 'text-white',
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
    variant === 'secondary' || variant === 'success'
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
