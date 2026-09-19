import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';
import { useLocale } from '@/lib/i18n';
import { dateKey, isToday, weekdayInitials } from '@/features/planning/calendar';
import { inMonth } from '@/features/planning/hooks/use-planning';
import type { PlanningItem } from '@/features/planning/types';

/**
 * The month, drawn the way a phone calendar draws one.
 *
 * Days carry dots, not counts: at this size a number is unreadable and a dot is
 * instant, and three dots plus "more" says "a full day" as well as "5" does. The
 * dots take the dealer's own type colours, so the palette on this grid is the
 * one they chose in their portal — this screen has no opinion about what a
 * measurement should look like.
 *
 * Six rows always, so the agenda below never jumps as you page months.
 */

const MAX_DOTS = 3;

export function MonthGrid({
  year,
  month,
  grid,
  byDay,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  grid: Date[];
  byDay: Map<string, PlanningItem[]>;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const c = useColors();
  // Weekday initials are language-dependent, so re-read them when it changes.
  const locale = useLocale();
  const initials = useMemo(() => weekdayInitials(), [locale]);

  return (
    <View className="px-3">
      <View className="mb-1 flex-row">
        {initials.map((day, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text className="text-xs text-muted-foreground">{day}</Text>
          </View>
        ))}
      </View>

      {Array.from({ length: 6 }, (_, week) => (
        <View key={week} className="flex-row">
          {grid.slice(week * 7, week * 7 + 7).map((date) => {
            const key = dateKey(date);
            const items = byDay.get(key) ?? [];
            const isSelected = key === selected;
            const today = isToday(date);
            const outside = !inMonth(date, year, month);

            return (
              <Pressable
                key={key}
                onPress={() => onSelect(key)}
                accessibilityRole="button"
                accessibilityState={isSelected ? { selected: true } : {}}
                className="flex-1 items-center py-1.5"
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isSelected
                      ? c.foreground
                      : today
                        ? c.muted
                        : 'transparent',
                  }}
                >
                  <Text
                    className={today && !isSelected ? 'text-sm font-bold' : 'text-sm'}
                    style={{
                      color: isSelected
                        ? c.background
                        : outside
                          ? c.mutedForeground
                          : c.foreground,
                      // The padding days stay visible but recede — they are
                      // context, not this month's work.
                      opacity: outside ? 0.45 : 1,
                    }}
                  >
                    {date.getDate()}
                  </Text>
                </View>

                {/* Reserve the dot row on every cell so rows never shift height. */}
                <View className="mt-0.5 h-1.5 flex-row items-center gap-0.5">
                  {items.slice(0, MAX_DOTS).map((item) => (
                    <View
                      // Ids are unique per source, not across them: a task 12
                      // and a calendar event 12 can share a day.
                      key={`${item.source}${item.id}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        // A synced block takes its own calendar's colour, so
                        // "the grey ones are from my Google" reads at a glance.
                        borderWidth: item.source === 'event' ? 1 : 0,
                        borderColor: item.calendarColor ?? c.mutedForeground,
                        backgroundColor:
                          item.source === 'event'
                            // Hollow: it is time occupied, not work booked here,
                            // and the ring says that without a legend.
                            ? 'transparent'
                            // The dealer's colour when they set one; otherwise
                            // the ink, which reads on both themes.
                            : item.type?.colorHex ?? c.foreground,
                        // Finished work is still shown — a calendar that hides
                        // it renders last week as empty — but it recedes.
                        opacity: item.status === 'done' ? 0.35 : 1,
                      }}
                    />
                  ))}
                  {items.length > MAX_DOTS ? (
                    <Text className="text-[9px] text-muted-foreground">+</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
