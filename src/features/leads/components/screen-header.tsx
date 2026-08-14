import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';

/**
 * Back arrow, title, and one optional action — the top of every lead screen.
 *
 * The stack renders no header of its own (see leads/_layout.tsx), so this is
 * the header; keeping it in one place is what stops the detail, the editor and
 * the send screen from drifting a few pixels apart.
 */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  /** Defaults to popping the stack. */
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const c = useColors();
  const router = useRouter();

  return (
    <View className="flex-row items-center gap-1 px-2 py-2">
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={10}
        accessibilityRole="button"
        className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
      >
        <Ionicons name="chevron-back" size={24} color={c.foreground} />
      </Pressable>
      <Text className="flex-1 pr-3 text-base font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
