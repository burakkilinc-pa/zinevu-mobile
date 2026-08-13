import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime } from '@/lib/time';
import type { PlanningItem } from '@/features/planning/types';

/**
 * One entry in the day's agenda.
 *
 * Laid out like a native calendar row: the time on the left in its own column,
 * a coloured rail, then the event. The rail is what makes a list of visits
 * scannable — it carries the dealer's own type colour, so "the green ones are
 * measurements" is knowledge that transfers straight from their portal.
 *
 * Address gets a tap of its own. Standing at the van, the thing you want is
 * not a detail screen, it is directions.
 */
export function AgendaItem({
  item,
  onPress,
}: {
  item: PlanningItem;
  onPress: () => void;
}) {
  const t = useT();
  const c = useColors();

  const rail = item.type?.colorHex ?? c.foreground;
  const done = item.status === 'done';
  const cancelled = item.status === 'cancelled';

  const end =
    item.dueAt && item.durationMinutes
      ? clockTime(new Date(new Date(item.dueAt).getTime() + item.durationMinutes * 60_000).toISOString())
      : null;

  // "Op locatie" / "bezig" — crew progress, which outranks the plain status
  // because it is the more recent, more specific truth about the same visit.
  const progress = item.workStartedAt
    ? t('planning.progress.working')
    : item.onSiteAt
      ? t('planning.progress.onSite')
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row gap-3 py-2 active:opacity-70"
      style={cancelled ? { opacity: 0.45 } : undefined}
    >
      <View className="w-14 items-end pt-0.5">
        <Text className="text-sm font-medium text-foreground">
          {item.dueAt ? clockTime(item.dueAt) : ''}
        </Text>
        {end ? <Text className="text-xs text-muted-foreground">{end}</Text> : null}
      </View>

      <View
        className="w-1 rounded-full"
        style={{ backgroundColor: rail, opacity: done ? 0.35 : 1 }}
      />

      <View className="flex-1 gap-1 pb-1">
        <Text
          className="text-[15px] font-medium text-foreground"
          numberOfLines={1}
          style={cancelled ? { textDecorationLine: 'line-through' } : undefined}
        >
          {item.title || item.type?.name || t('planning.untitled')}
        </Text>

        {item.customerName ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {item.customerName}
          </Text>
        ) : null}

        {item.locationAddress ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            onPress={() =>
              Linking.openURL(
                // The OS picks the map app the user actually uses.
                `https://maps.apple.com/?daddr=${encodeURIComponent(item.locationAddress!)}`
              )
            }
            className="flex-row items-center gap-1"
          >
            <Ionicons name="navigate-outline" size={13} color={c.mutedForeground} />
            <Text className="flex-1 text-xs text-muted-foreground underline" numberOfLines={1}>
              {item.locationAddress}
            </Text>
          </Pressable>
        ) : null}

        <View className="flex-row items-center gap-2">
          {done ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkmark-circle" size={13} color={c.success} />
              <Text className="text-xs" style={{ color: c.success }}>
                {t('planning.status.done')}
              </Text>
            </View>
          ) : progress ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="ellipse" size={8} color={c.warning} />
              <Text className="text-xs" style={{ color: c.warning }}>
                {progress}
              </Text>
            </View>
          ) : null}

          {item.assigneeName ? (
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {item.assigneeName}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
