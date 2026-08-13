import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { useColors } from '@/lib/theme';

/** Stand-in for a feature that ships in a later phase. */
export function Placeholder({
  icon = 'sparkles-outline',
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  const colors = useColors();
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-3">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Ionicons name={icon} size={28} color={colors.foreground} />
        </View>
        <Text className="text-xl font-bold text-foreground">{title}</Text>
        <Text className="max-w-xs text-center text-base text-muted-foreground">
          {subtitle}
        </Text>
      </View>
    </Screen>
  );
}
