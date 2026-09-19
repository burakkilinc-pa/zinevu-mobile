import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { followUpTypeLabel } from '@/features/planning/type-label';
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
 *
 * It renders two kinds of entry. A Zinevu task is the loud one. A block synced in
 * from the dealer's own calendar is deliberately quieter — faded rail, lighter
 * title, a sync mark and the calendar's name — because it answers a different
 * question: not "what am I doing" but "why this afternoon is already gone".
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

  const isEvent = item.source === 'event';
  const rail = isEvent
    ? item.calendarColor ?? c.mutedForeground
    : item.type?.colorHex ?? c.foreground;
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
        {item.allDay ? (
          // An all-day block has no clock time to show, and rendering "00:00"
          // would read as a midnight appointment.
          <Text className="text-xs font-medium text-muted-foreground">
            {t('planning.allDay')}
          </Text>
        ) : (
          <>
            <Text className="text-sm font-medium text-foreground">
              {item.dueAt ? clockTime(item.dueAt) : ''}
            </Text>
            {end ? <Text className="text-xs text-muted-foreground">{end}</Text> : null}
          </>
        )}
      </View>

      <View
        className="w-1 rounded-full"
        style={{
          backgroundColor: rail,
          // A synced block's rail is faded and its title is lighter: it belongs
          // on the day, but it is not this dealer's work to do.
          opacity: done ? 0.35 : isEvent ? 0.5 : 1,
        }}
      />

      <View className="flex-1 gap-1 pb-1">
        <View className="flex-row items-center gap-1.5">
          {isEvent ? (
            <Ionicons name="sync-outline" size={13} color={c.mutedForeground} />
          ) : null}
          <Text
            className={
              isEvent
                ? 'flex-1 text-[15px] text-muted-foreground'
                : 'flex-1 text-[15px] font-medium text-foreground'
            }
            numberOfLines={1}
            style={cancelled ? { textDecorationLine: 'line-through' } : undefined}
          >
            {item.title || followUpTypeLabel(t, item.type) || t('planning.untitled')}
          </Text>
        </View>

        {/* Which calendar it came from — the dealer has more than one linked,
            and "Privé" vs "Werk" is the whole reason to show the source. */}
        {isEvent && item.calendarName ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {item.calendarName}
          </Text>
        ) : null}

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
