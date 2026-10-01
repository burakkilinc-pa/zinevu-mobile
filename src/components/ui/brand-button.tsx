import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Plate, PLATE, PLATE_PRESSED } from '@/components/ui/plate';
import { useColors } from '@/lib/theme';

/**
 * The brand's button: a lime face on a black edge, standing on a solid plate,
 * with the icon in the black chip zinevu.com puts on its leading edge.
 *
 * ONE component because it is one object. It was written twice — once floating
 * over the leads list as "New lead", once as a plain lime pill on the support
 * screen — and the second one was missing the chip, the weight and the press,
 * which is exactly how two buttons that are meant to be the same stop being it.
 *
 * Pressing it is a real press: the face travels into its plate (the plate does
 * not move — that is the half that reads as going down), turns black with a
 * white label, and the chip swaps the other way, as the site's buttons do on
 * hover.
 */
export function BrandButton({
  label,
  icon = 'add',
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const c = useColors();
  const [pressed, setPressed] = useState(false);
  const sink = pressed ? PLATE - PLATE_PRESSED : 0;

  return (
    <View>
      <Plate radius={999} />

      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="flex-row items-center gap-2.5 rounded-full py-2 pl-2 pr-5"
        style={{
          backgroundColor: pressed ? c.ink : c.primary,
          borderWidth: 1.5,
          borderColor: c.ink,
          transform: [{ translateX: sink }, { translateY: sink }],
        }}
      >
        <View
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: pressed ? c.primary : c.primaryForeground }}
        >
          <Ionicons name={icon} size={20} color={pressed ? c.primaryForeground : c.primary} />
        </View>
        <Text
          className="text-base font-bold"
          style={{ color: pressed ? c.onInk : c.primaryForeground }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
