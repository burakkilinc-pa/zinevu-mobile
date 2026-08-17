import type { Ionicons } from '@expo/vector-icons';

/**
 * The dealer's `icon_key` is a Lucide name — the portal renders Lucide, this app
 * renders Ionicons, and the catalogue is shared. Translate rather than ship a
 * second icon set for five rows in a bottom sheet.
 *
 * Anything unmapped falls back by BEHAVIOR, not to a generic dot: a type the
 * dealer added last week should still look like a drive if it is one.
 */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  phone: 'call-outline',
  mail: 'mail-outline',
  'map-pin': 'location-outline',
  ruler: 'resize-outline',
  'hard-hat': 'construct-outline',
  wrench: 'build-outline',
  package: 'cube-outline',
  truck: 'bus-outline',
  factory: 'business-outline',
  'shopping-cart': 'cart-outline',
  circle: 'ellipse-outline',
};

export function followUpIcon(
  iconKey: string | null | undefined,
  behavior: 'field_visit' | 'reminder'
): keyof typeof Ionicons.glyphMap {
  const hit = iconKey ? ICONS[iconKey] : undefined;
  if (hit) return hit;

  return behavior === 'field_visit' ? 'car-outline' : 'notifications-outline';
}
