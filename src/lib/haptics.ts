import * as Haptics from 'expo-haptics';

type Kind = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

/**
 * Fire-and-forget haptic feedback that NEVER throws. Haptics are optional polish;
 * if the native module isn't linked (e.g. Expo Go, or a dev build made before the
 * dependency was added) the call must degrade silently instead of surfacing an
 * uncaught promise rejection.
 */
export function haptic(kind: Kind = 'selection'): void {
  try {
    switch (kind) {
      case 'selection':
        Haptics.selectionAsync().catch(noop);
        break;
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(noop);
        break;
      case 'success':
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(noop);
        break;
      case 'warning':
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        ).catch(noop);
        break;
      case 'error':
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(noop);
        break;
    }
  } catch {
    // native module missing → ignore
  }
}

function noop() {}
