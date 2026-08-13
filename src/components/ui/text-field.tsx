import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, containerClassName, className, style, ...props }, ref) => {
    const colors = useColors();
    return (
      <View className={cn('gap-1.5', containerClassName)}>
        {label ? (
          <Text className="text-sm font-medium text-foreground">{label}</Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          // fontSize via style, NOT `text-base`: that class also sets
          // lineHeight 24, which on iOS pushes a single-line input's text off
          // its vertical centre. The natural line height keeps it centred.
          className={cn(
            'h-12 rounded-md border border-border bg-card px-4 text-foreground',
            error && 'border-destructive',
            className
          )}
          style={[{ fontSize: 16 }, style]}
          {...props}
        />
        {error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
