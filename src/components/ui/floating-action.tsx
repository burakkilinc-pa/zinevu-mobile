import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';

/** How far the plate sits behind the face, at rest and while pressed. */
const PLATE = 3;
const PLATE_PRESSED = 1;

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
  const offset = pressed ? PLATE_PRESSED : PLATE;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="absolute right-5 flex-row items-center gap-2.5 rounded-full py-2 pl-2 pr-5"
      style={{
        bottom: insets.bottom + 86,
        backgroundColor: pressed ? c.ink : c.primary,
        borderWidth: 1.5,
        borderColor: c.ink,
        transform: [{ translateX: PLATE - offset }, { translateY: PLATE - offset }],
        shadowColor: c.ink,
        shadowOpacity: 1,
        shadowRadius: 0,
        shadowOffset: { width: offset, height: offset },
        elevation: 8,
      }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: pressed ? c.primary : c.primaryForeground }}
      >
        <Ionicons name={icon} size={20} color={pressed ? c.primaryForeground : c.primary} />
      </View>
      <Text className="text-base font-bold" style={{ color: pressed ? c.onInk : c.primaryForeground }}>
        {label}
      </Text>
    </Pressable>
  );
}
