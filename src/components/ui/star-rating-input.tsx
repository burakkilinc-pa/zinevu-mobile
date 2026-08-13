import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';

/** Tappable 1–5 star row. value 0 = unset. */
export function StarRatingInput({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const colors = useColors();
  return (
    <View className="flex-row gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onChange(star)} hitSlop={4}>
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={star <= value ? colors.warning : colors.mutedForeground}
          />
        </Pressable>
      ))}
    </View>
  );
}
