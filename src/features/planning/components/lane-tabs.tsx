import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { PLANNING_LANES, type PlanningLane } from '@/features/planning/types';

/**
 * Visits / Follow-ups / All — the same three chips the portal's calendar has, in
 * the same order, so the two screens filter alike.
 *
 * The lane, not the status, is the filter that belongs at the top of a phone
 * calendar: a dealer's month is planned around the drives, and a grid whose dots
 * are mostly "call this person back" hides them. The count rides in the chip
 * because it answers the question the chip raises — "is there anything in there"
 * — without spending the tap.
 *
 * Each lane keeps its own icon: at a glance the row is read by shape rather than
 * by reading three words in whichever of five languages is on.
 */

const ICONS: Record<PlanningLane, keyof typeof Ionicons.glyphMap> = {
  visits: 'car-outline',
  followups: 'notifications-outline',
  all: 'layers-outline',
};

export function LaneTabs({
  value,
  onChange,
  counts,
}: {
  value: PlanningLane;
  onChange: (lane: PlanningLane) => void;
  counts: Record<PlanningLane, number>;
}) {
  const t = useT();
  const c = useColors();

  return (
    // Same flexGrow:0 guard as the leads filter row: a horizontal ScrollView
    // with no height constraint eats the rest of the column and stretches every
    // chip to that height.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 4,
        alignItems: 'center',
      }}
    >
      {PLANNING_LANES.map((lane) => {
        const active = lane === value;

        return (
          <Pressable
            key={lane}
            onPress={() => onChange(lane)}
            accessibilityRole="button"
            accessibilityState={active ? { selected: true } : {}}
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: active ? c.foreground : c.muted }}
          >
            <Ionicons
              name={ICONS[lane]}
              size={14}
              color={active ? c.background : c.foreground}
            />
            <Text
              className="text-sm font-medium"
              style={{ color: active ? c.background : c.foreground }}
            >
              {t(`planning.lane.${lane}` as MessageKey)}
            </Text>
            {counts[lane] > 0 ? (
              <View
                className="rounded-full px-1.5"
                style={{ backgroundColor: active ? c.background : c.card }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: active ? c.foreground : c.mutedForeground }}
                >
                  {counts[lane]}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
