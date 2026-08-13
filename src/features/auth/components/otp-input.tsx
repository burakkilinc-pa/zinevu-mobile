import { useRef } from 'react';
import { TextInput, View } from 'react-native';

import { useColors } from '@/lib/theme';

/**
 * Segmented access-code input (WhatsApp/Booking-style): one box per digit, split
 * in the middle with a dash, auto-advance + backspace, and full-code paste /
 * iOS one-time-code autofill into the first box.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
}) {
  const c = useColors();
  const refs = useRef<Array<TextInput | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? '');

  function commit(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    return clean;
  }

  function handleChange(index: number, text: string) {
    const digits = text.replace(/\D/g, '');
    if (digits.length > 1) {
      // Paste / autofill: spread from this box onward.
      const merged = (value.slice(0, index) + digits).slice(0, length);
      const clean = commit(merged);
      const focus = Math.min(clean.length, length - 1);
      refs.current[focus]?.focus();
      if (clean.length === length) onComplete?.(clean);
      return;
    }
    const arr = Array.from({ length }, (_, i) => value[i] ?? '');
    arr[index] = digits;
    const clean = commit(arr.join(''));
    if (digits && index < length - 1) refs.current[index + 1]?.focus();
    if (clean.length === length) onComplete?.(clean);
  }

  function handleKey(index: number, key: string) {
    if (key === 'Backspace' && !chars[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-2">
          {i === length / 2 ? (
            <View className="h-0.5 w-2.5 rounded-full bg-border" />
          ) : null}
          <TextInput
            ref={(r) => {
              refs.current[i] = r;
            }}
            value={chars[i]}
            onChangeText={(text) => handleChange(i, text)}
            onKeyPress={(e) => handleKey(i, e.nativeEvent.key)}
            keyboardType="number-pad"
            // First box wide-open so a full-code paste / OTP autofill lands.
            maxLength={i === 0 ? length : 1}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            selectionColor={c.foreground}
            className={`h-14 w-12 rounded-xl border-2 bg-card text-center text-2xl font-bold text-foreground ${
              chars[i] ? 'border-foreground' : 'border-border'
            }`}
          />
        </View>
      ))}
    </View>
  );
}
