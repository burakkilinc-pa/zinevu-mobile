import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/lib/theme';

/**
 * Custom Zinevu bottom navigation — a floating ink pill "dock" with a
 * notch carved into the top-centre. The user's landing screen sits in that
 * notch as a ring-less lime circle wearing the Zinevu Z (brand hero); the
 * remaining tabs are icon-only (no labels), split evenly left and right. The
 * centre button springs on press (reanimated, UI thread).
 *
 * The notch is done WITHOUT any native drawing library: a circle painted in the
 * screen's background colour sits inside an overflow-clipped layer over the
 * ink body — its lower arc bites a concave cradle out of the top edge, and the
 * clip hides everything above the dock, so no native module / rebuild is needed.
 * The colour is theme-aware (useColors().background) so the cradle matches the
 * page behind it in light and dark.
 *
 * Props are typed inline on purpose: importing BottomTabBarProps from
 * @react-navigation/bottom-tabs pulls react-navigation into the graph, which
 * breaks the expo-router SDK 57 bundle (see expo-export-before-eas-build memo).
 */

const DOCK = '#082D36'; // brand ink (Zinevu navy), the dock body
const ACTIVE_PILL = '#E7FFA4'; // brand lime — the portal's active-nav colour
const ACTIVE_FG = '#082D36'; // ink emblem on the lime circle
const INACTIVE_FG = 'rgba(246,247,249,0.6)'; // cloud, dimmed (inactive icons)

const DOCK_H = 64; // dock bar height
const DOCK_R = 32; // dock corner radius
const FAB_SIZE = 60; // diameter of the centre button
const FAB_LIFT = 10; // how far its centre rises above the dock middle (small poke)
const MARK_SIZE = 34; // brand Z mark inside the FAB

// Notch cradle: a background-coloured circle whose lower arc carves the top
// edge. Radius + centre-Y (negative = above the dock) set the opening & depth.
const NOTCH_R = 29;
const NOTCH_CY = -13; // depth ≈ NOTCH_R + NOTCH_CY (~16pt), opening ≈ 52pt

const MARK = require('../../assets/images/android-icon-foreground.png');

type TabIcon = (a: { focused: boolean; color: string; size: number }) => ReactNode;

type TabOptions = {
  title?: string;
  tabBarBadge?: number | string;
  tabBarIcon?: TabIcon;
  // expo-router maps `href: null` (role-hidden tabs) to this — the only
  // reliable signal that a screen must not appear in the dock. Typed loosely
  // (`any`) so the real BottomTabDescriptorMap's StyleProp<ViewStyle> stays
  // assignable; `isHidden` reads `.display` off it defensively.
  tabBarItemStyle?: any;
};

type Route = { key: string; name: string };

type TabBarProps = {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: TabOptions }>;
  navigation: {
    navigate: (name: string) => void;
    // Loosely typed: the real BottomTabBarProps emit is generic over event
    // names; `any` here lets us accept it without importing @react-navigation.
    emit: (e: any) => any;
  };
  // Route name that should occupy the notch (the space's landing screen).
  // Falls back to a flat dock if it isn't among the visible tabs.
  centerRoute?: string;
};

export function BrandTabBar({ state, descriptors, navigation, centerRoute }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const notchColor = useColors().background;

  // Only tabs relevant to the current user's space. expo-router hides
  // role-mismatched screens (href={null}) by stamping tabBarItemStyle.display
  // = 'none'; the default tab bar honours that, but this custom dock renders
  // its own buttons, so we filter those routes out ourselves — otherwise every
  // role's tabs pile into one dock.
  const routes = state.routes.filter(
    (route) => !isHidden(descriptors[route.key]?.options.tabBarItemStyle),
  );

  const activeKey = state.routes[state.index]?.key;

  // Split the visible tabs around the centre (landing) route. The remaining
  // count is always even per role (4 or 2), so left/right stay symmetric.
  const center = routes.find((r) => r.name === centerRoute);
  const sides = routes.filter((r) => r.name !== centerRoute);
  const half = Math.ceil(sides.length / 2);
  const left = sides.slice(0, half);
  const right = sides.slice(half);

  function press(route: Route) {
    const focused = route.key === activeKey;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          height: DOCK_H,
          borderRadius: DOCK_R,
          backgroundColor: DOCK,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        {/* Notch: a bg-coloured circle clipped to the dock, biting a cradle out
            of the top-centre. Only its lower arc shows; the clip hides the rest.
            Rendered only when there's a centre tab to sit in it. */}
        {center ? (
          <View
            pointerEvents="none"
            style={{ ...StyleFill, borderRadius: DOCK_R, overflow: 'hidden' }}
          >
            <View
              style={{
                position: 'absolute',
                top: NOTCH_CY - NOTCH_R,
                left: '50%',
                marginLeft: -NOTCH_R,
                width: NOTCH_R * 2,
                height: NOTCH_R * 2,
                borderRadius: NOTCH_R,
                backgroundColor: notchColor,
              }}
            />
          </View>
        ) : null}

        {left.map((route) => (
          <SideTab
            key={route.key}
            options={descriptors[route.key]?.options ?? {}}
            focused={route.key === activeKey}
            onPress={() => press(route)}
          />
        ))}

        {center ? (
          <CenterTab
            options={descriptors[center.key]?.options ?? {}}
            focused={center.key === activeKey}
            onPress={() => press(center)}
          />
        ) : null}

        {right.map((route) => (
          <SideTab
            key={route.key}
            options={descriptors[route.key]?.options ?? {}}
            focused={route.key === activeKey}
            onPress={() => press(route)}
          />
        ))}
      </View>
    </View>
  );
}

const StyleFill = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const;

/** True when expo-router hid this tab via `href: null` (display:'none'). */
function isHidden(style: any): boolean {
  if (Array.isArray(style)) return style.some(isHidden);
  return style?.display === 'none';
}

/**
 * A flat, label-free side tab. Active tabs light to lime with a filled icon
 * (the icon component swaps filled/outline on `focused`); inactive tabs are a
 * dimmed cloud outline. No text — the modern, minimal look.
 */
function SideTab({
  options,
  focused,
  onPress,
}: {
  options: TabOptions;
  focused: boolean;
  onPress: () => void;
}) {
  const color = focused ? ACTIVE_PILL : INACTIVE_FG;
  const badge = options.tabBarBadge;

  // Instagram-style feedback: a soft lime highlight springs open behind the
  // active icon (grows in on select, shrinks out on deselect), and the icon
  // gives a quick bounce on press. Both run on the UI thread (reanimated).
  const pill = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    pill.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 210 });
  }, [focused, pill]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.value,
    transform: [{ scale: 0.5 + pill.value * 0.5 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(0.82, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 10, stiffness: 220 });
      }}
      accessibilityRole="button"
      accessibilityLabel={options.title}
      accessibilityState={focused ? { selected: true } : {}}
      style={{
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: 46,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(231,255,164,0.16)',
            },
            pillStyle,
          ]}
        />
        <Animated.View style={iconStyle}>
          {options.tabBarIcon?.({ focused, color, size: 26 })}
        </Animated.View>
        {badge != null && badge !== '' ? (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -12,
              minWidth: 17,
              height: 17,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: '#B91C1C',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The centre button: a ring-less lime circle carrying the Zinevu Z, nestled in
 * the dock's notch. Springs on press.
 */
function CenterTab({
  options,
  focused,
  onPress,
}: {
  options: TabOptions;
  focused: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -FAB_LIFT }, { scale: scale.value }],
  }));

  return (
    <View
      style={{
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={[{ alignSelf: 'center' }, style]}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            scale.value = withSpring(0.9, { damping: 15, stiffness: 220 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 12, stiffness: 200 });
          }}
          accessibilityRole="button"
          accessibilityLabel={options.title}
          accessibilityState={focused ? { selected: true } : {}}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            backgroundColor: ACTIVE_PILL,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.24,
            shadowRadius: 9,
            shadowOffset: { width: 0, height: 4 },
            elevation: 10,
          }}
        >
          <Image
            source={MARK}
            contentFit="contain"
            tintColor={ACTIVE_FG}
            style={{ width: MARK_SIZE, height: MARK_SIZE, opacity: focused ? 1 : 0.9 }}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}
