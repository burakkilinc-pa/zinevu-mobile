import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { dayLabel } from '@/lib/time';
import { addMonths, dateKey, monthTitle } from '@/features/planning/calendar';
import { usePlanningMonth } from '@/features/planning/hooks/use-planning';
import { MonthGrid } from '@/features/planning/components/month-grid';
import { AgendaItem } from '@/features/planning/components/agenda-item';

/**
 * Planning — the month, and the selected day's agenda under it.
 *
 * The shape every phone calendar settled on, and for a reason: the grid answers
 * "how busy is this week" at a glance while the list answers "what am I doing
 * next", and neither can do the other's job. Selecting a day never navigates —
 * the agenda swaps in place, so paging through a week is a series of taps
 * rather than pushes and backs.
 */
export default function PlanningScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState(() => dateKey(today));

  const { grid, byDay, isLoading, isError, allowed, refetch, isRefetching } =
    usePlanningMonth(cursor.year, cursor.month);

  const dayItems = byDay.get(selected) ?? [];

  function goToMonth(delta: number) {
    setCursor((prev) => addMonths(prev.year, prev.month, delta));
  }

  function goToToday() {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(dateKey(now));
  }

  if (!allowed) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('planning.noAccess.title')}
        subtitle={t('planning.noAccess.body')}
      />
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <View className="flex-row items-center gap-1 px-3 py-2">
        <Text className="flex-1 pl-2 text-2xl font-bold capitalize text-foreground">
          {monthTitle(cursor.year, cursor.month)}
        </Text>

        <HeaderButton icon="today-outline" label={t('planning.today')} onPress={goToToday} />
        <HeaderButton icon="chevron-back" label={t('planning.prevMonth')} onPress={() => goToMonth(-1)} />
        <HeaderButton icon="chevron-forward" label={t('planning.nextMonth')} onPress={() => goToMonth(1)} />
      </View>

      <MonthGrid
        year={cursor.year}
        month={cursor.month}
        grid={grid}
        byDay={byDay}
        selected={selected}
        onSelect={setSelected}
      />

      <View className="mt-3 flex-row items-center gap-2 border-t border-border px-5 pb-1 pt-3">
        <Text className="flex-1 text-base font-semibold text-foreground">
          {dayLabel(`${selected}T12:00:00`)}
        </Text>
        {isLoading || isRefetching ? <ActivityIndicator size="small" color={c.mutedForeground} /> : null}
        <Pressable
          onPress={() => void refetch()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
        >
          <Ionicons name="refresh" size={16} color={c.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottom }}
      >
        {isError ? (
          <Text className="py-10 text-center text-sm text-destructive">{t('common.error')}</Text>
        ) : dayItems.length === 0 ? (
          <View className="items-center gap-2 py-12">
            <Ionicons name="calendar-clear-outline" size={24} color={c.mutedForeground} />
            <Text className="text-sm text-muted-foreground">{t('planning.emptyDay')}</Text>
          </View>
        ) : (
          dayItems.map((item) => (
            <AgendaItem
              key={item.id}
              item={item}
              // A visit hanging off a lead opens that lead — it is the only
              // place with the customer, the offer and the configuration. A
              // standalone visit has nowhere fuller to go, so it stays put.
              onPress={() => {
                if (item.leadRef) router.push(`/leads/${item.leadRef}`);
              }}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
    >
      <Ionicons name={icon} size={20} color={c.foreground} />
    </Pressable>
  );
}
