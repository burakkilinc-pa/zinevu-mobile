import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BrandButton } from '@/components/ui/brand-button';

/**
 * The brand's button, parked at the thumb's resting place over a scrolling
 * list. Everything it looks like lives in BrandButton — this only decides where
 * it sits, and clears the floating dock (~62pt + margin) so the two never
 * overlap.
 */
export function FloatingAction({
  label,
  icon = 'add',
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute right-5"
      style={{ bottom: insets.bottom + 86 }}
      pointerEvents="box-none"
    >
      <BrandButton label={label} icon={icon} onPress={onPress} />
    </View>
  );
}
