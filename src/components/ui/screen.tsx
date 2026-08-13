import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type ScreenProps = {
  children: ReactNode;
  /** Adds default screen padding. */
  padded?: boolean;
  edges?: Edge[];
  /**
   * Reserve space for the bottom tab bar. The (app) tab scene is drawn
   * full-height *behind* the tab bar, so any list/scroll content that fills the
   * screen would otherwise have its last rows hidden under it. Set this on every
   * screen that renders under the tabs; leave it off for the login screen and
   * the in-thread chat (which hides the tab bar). Expo-router exposes no
   * bottom-tab-height hook — importing @react-navigation/* breaks the SDK 57
   * bundle — so we approximate: ~56pt bar + the bottom safe-area inset.
   */
  tabBar?: boolean;
  className?: string;
};

/**
 * Bottom padding a scrolling tab screen must add to its *content* so the last
 * row clears the floating dock (~62pt bar + margin) plus the safe-area inset.
 * Pair it with `<Screen edges={['top']}>` (no `tabBar`) so the scroll view
 * fills the full height and content flows under the translucent dock — the same
 * treatment the Messages list uses. Screens that reserve space on the container
 * instead (`tabBar`) leave a dead gap under the dock.
 */
export function useDockClearance(): number {
  return useSafeAreaInsets().bottom + 74;
}

/** Safe-area-aware page container with the app background. */
export function Screen({
  children,
  padded = true,
  edges = ['top', 'bottom'],
  tabBar = false,
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // When reserving the tab bar we own the bottom spacing ourselves, so drop the
  // safe-area bottom edge to avoid stacking two insets.
  const resolvedEdges = tabBar ? edges.filter((e) => e !== 'bottom') : edges;
  return (
    <SafeAreaView edges={resolvedEdges} className="flex-1 bg-background">
      <View
        className={cn('flex-1', padded && 'px-5 py-4', className)}
        style={tabBar ? { paddingBottom: insets.bottom + 74 } : undefined}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
