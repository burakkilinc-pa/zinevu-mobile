import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { PLATE, PLATE_PRESSED } from '@/components/ui/plate';

/**
 * The floating "+ New …" button at the thumb's resting place, in the site's
 * physical language.
 *
 * It floats over a scrolling list, so it is the one control that earns
 * zinevu.com's solid offset plate — the site's shadow, never a blur — and the
 * 1.5px black edge that goes with it. Pressing it is a real press: the face
 * moves into its plate, and turns black with a white label while the finger
 * is down, as the site's buttons do on hover.
 *
 * THE PLATE IS A REAL LAYER, not a shadow with its blur set to zero. iOS
 * rasterises a zero-radius shadow from the layer's shadow path with no
 * antialiasing, so on a pill — all curve, no straight edge — the plate came out
 * with ragged, visibly pixelated ends. A plain rounded View behind the face is
 * drawn by the GPU like any other rectangle: clean at every radius, and it
 * behaves the same on Android, where `elevation` would have given a blur the
 * brand does not use.
 *
 * Clears the floating dock (~62pt + margin) so the two never overlap.
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
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);

  // The plate never moves. The face travels into it, which is what makes the
  // press read as the button going down rather than the shadow sliding out.
  const sink = pressed ? PLATE - PLATE_PRESSED : 0;

  return (
    <View
      className="absolute right-5"
      style={{ bottom: insets.bottom + 86 }}
      pointerEvents="box-none"
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 999,
          backgroundColor: c.ink,
          transform: [{ translateX: PLATE }, { translateY: PLATE }],
        }}
      />

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
