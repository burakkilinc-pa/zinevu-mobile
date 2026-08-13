import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Thin wrapper around expo-notifications.
 *
 * The module is native, so a dev build made before it was added does not
 * contain it — and importing it there blows up ("Cannot find native module
 * 'ExpoPushTokenManager'"), taking the whole app down. Push is optional
 * polish, so we probe for the native side first and degrade to no-ops,
 * exactly like `lib/haptics`. Run `npx expo run:ios` (or a new EAS dev
 * build) to actually get notifications.
 */

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

export function notifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;

  // requireOptionalNativeModule returns null instead of throwing when the
  // binary wasn't built with the module in it.
  if (requireOptionalNativeModule('ExpoPushTokenManager') == null) {
    cached = null;
    return cached;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function pushAvailable(): boolean {
  return notifications() !== null;
}

/** iOS shows the app icon badge; a no-op elsewhere. */
export function setBadgeCount(count: number): void {
  const api = notifications();
  if (!api) return;
  void api.setBadgeCountAsync(Math.max(0, count)).catch(() => {});
}
