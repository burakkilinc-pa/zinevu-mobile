import { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  containerClassName?: string;
  /** Show an eye button that reveals the text. Only for `secureTextEntry`. */
  revealToggle?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    { label, error, containerClassName, className, style, revealToggle, ...props },
    ref
  ) => {
    const colors = useColors();
    const t = useT();
    const [revealed, setRevealed] = useState(false);
    const showEye = revealToggle && props.secureTextEntry;
    return (
      <View className={cn('gap-1.5', containerClassName)}>
        {label ? (
          <Text className="text-sm font-medium text-foreground">{label}</Text>
        ) : null}
        <View className="relative justify-center">
          <TextInput
            ref={ref}
            placeholderTextColor={colors.mutedForeground}
            // fontSize via style, NOT `text-base`: that class also sets
            // lineHeight 24, which on iOS pushes a single-line input's text off
            // its vertical centre. The natural line height keeps it centred.
            className={cn(
              'h-12 rounded-md border border-border bg-card px-4 text-foreground',
              error && 'border-destructive',
              showEye && 'pr-12',
              className
            )}
            style={[{ fontSize: 16 }, style]}
            {...props}
            secureTextEntry={props.secureTextEntry && !revealed}
          />
          {showEye ? (
            <Pressable
              onPress={() => setRevealed((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={t(
                revealed ? 'auth.login.hidePassword' : 'auth.login.showPassword'
              )}
              hitSlop={8}
              className="absolute right-1 h-10 w-10 items-center justify-center"
            >
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={19}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
