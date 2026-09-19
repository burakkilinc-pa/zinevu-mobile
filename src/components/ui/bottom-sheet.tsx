import { useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

// How far the card starts below its resting place. Taller than any sheet here
// gets, so it is fully off-screen at rest whatever the row count.
const TRAVEL = 700;

/**
 * The app's bottom sheet: a card that rises from the bottom edge over a dimmed
 * page.
 *
 * The animation is ours rather than RN's `animationType="slide"`, because that
 * one slides the dim layer up along WITH the card — the darkening then reads as
 * a grey sheet of paper being pushed over the screen from below. Here the scrim
 * only fades, and the card is the only thing that travels, which is what every
 * native sheet does.
 *
 * The scrim covers the full screen, card included: it has to keep going behind
 * the rounded top corners, or those corners cut through to the undimmed page
 * and the curve stops reading as a curve.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  // Keeps the Modal on screen long enough to play the closing animation out.
  // Set during render (not in an effect) so the card never flashes at rest
  // before the opening animation starts.
  const [mounted, setMounted] = useState(visible);
  const [wasVisible, setWasVisible] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 260 });
    } else {
      progress.value = withTiming(0, { duration: 200 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * TRAVEL }],
  }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, scrimStyle]}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={{ flex: 1, backgroundColor: 'rgba(8,45,54,0.45)' }}
          />
        </Animated.View>

        <Animated.View
          style={[
            {
              backgroundColor: c.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              overflow: 'hidden',
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: (insets.bottom || 12) + 12,
            },
            cardStyle,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: c.border,
            }}
          />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
