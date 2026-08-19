import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { useFollowUpTypes } from '@/features/planning/hooks/use-planning';
import { followUpIcon } from '@/features/planning/icons';
import { followUpTypeLabel } from '@/features/planning/type-label';
import type { FollowUpTypeOption } from '@/features/planning/types';

/**
 * "New visit" — the `+` of the planning screen, and unlike the leads one it
 * always asks WHAT first.
 *
 * A dealer books a measurement, a montage, a delivery and a service call, and
 * those are not variations of one form: the type decides the block length, the
 * colour it takes on the grid, and whether an address is required at all. So the
 * sheet is the dealer's own catalogue rather than a fixed menu — a type they add
 * in settings shows up here without this file changing.
 *
 * Field visits are listed first and reminders under their own heading, because
 * the reason to press this button is nearly always a drive. It never collapses
 * to a single form the way the leads button does: even with one type live,
 * "which kind" is the question this screen exists to answer.
 */
export function NewVisitButton({ date }: { date: string }) {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const types = useFollowUpTypes();
  const [open, setOpen] = useState(false);

  const { visits, reminders } = useMemo(() => {
    const all = types.data ?? [];

    return {
      visits: all.filter((type) => type.behavior === 'field_visit'),
      reminders: all.filter((type) => type.behavior !== 'field_visit'),
    };
  }, [types.data]);

  function pick(type: FollowUpTypeOption) {
    setOpen(false);
    // The day the calendar is on rides along, so booking from the 21st opens a
    // form already dated the 21st — that is the whole reason to start here
    // rather than from the lead.
    router.push({
      pathname: '/planning/new',
      params: { typeId: String(type.id), date },
    });
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('planning.new.action')}
        className="absolute right-5 flex-row items-center gap-2 rounded-full px-5 py-4 active:opacity-90"
        style={{
          // Clears the floating dock (~62pt + margin), same as the leads button.
          bottom: insets.bottom + 86,
          backgroundColor: c.primary,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={22} color={c.background} />
        <Text className="text-base font-semibold" style={{ color: c.background }}>
          {t('planning.new.action')}
        </Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text className="mb-2 mt-4 text-lg font-bold text-foreground">
          {t('planning.new.pick')}
        </Text>

        {visits.length === 0 && reminders.length === 0 ? (
          <Text className="pb-4 text-sm text-muted-foreground">
            {types.isLoading ? t('common.loading') : t('planning.new.noTypes')}
          </Text>
        ) : (
          // Capped height: a dealer with a dozen types would otherwise push the
          // sheet past the top of the screen.
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <TypeGroup
              title={t('planning.new.groupVisits')}
              types={visits}
              onPick={pick}
            />
            <TypeGroup
              title={t('planning.new.groupReminders')}
              types={reminders}
              onPick={pick}
            />
          </ScrollView>
        )}
      </BottomSheet>
    </>
  );
}

function TypeGroup({
  title,
  types,
  onPick,
}: {
  title: string;
  types: FollowUpTypeOption[];
  onPick: (type: FollowUpTypeOption) => void;
}) {
  const t = useT();
  const c = useColors();

  if (types.length === 0) return null;

  return (
    <View className="pb-1">
      <Text className="px-1 pb-1 pt-3 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </Text>

      {types.map((type) => (
        <Pressable
          key={type.id}
          onPress={() => onPick(type)}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-xl px-1 py-3 active:bg-muted"
        >
          {/* The dealer's own colour, so the sheet and the grid agree about
              what a montage looks like. */}
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: `${type.colorHex ?? '#64748b'}22` }}
          >
            <Ionicons
              name={followUpIcon(type.iconKey, type.behavior)}
              size={18}
              color={type.colorHex ?? c.foreground}
            />
          </View>

          <View className="flex-1">
            <Text className="text-base text-foreground">{followUpTypeLabel(t, type)}</Text>
            {type.defaultDurationMinutes ? (
              <Text className="text-xs text-muted-foreground">
                {t('planning.new.defaultDuration', {
                  n: type.defaultDurationMinutes,
                })}
              </Text>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}
