import { Pressable, ScrollView, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import type { AssigneeFilter, TeamMember } from '@/features/tasks/types';

/**
 * Whose work the queue is showing: Everyone · Mine · each colleague.
 *
 * Same row the portal board carries, in the same order. "Mine" sits second
 * rather than first because the queue's default is the whole team's: a dealer
 * opening this screen is usually asking "is anything on fire", not "what is on
 * my own plate" — and the chip makes the narrower question one tap.
 *
 * Counts ride in the chips, which is the point of them: the question a filter
 * raises is whether there is anything behind it, and that is exactly what you
 * cannot see from inside another filter.
 */
export function AssigneeChips({
  value,
  onChange,
  team,
  counts,
}: {
  value: AssigneeFilter;
  onChange: (next: AssigneeFilter) => void;
  team: TeamMember[];
  counts: { all: number; mine: number; byAssignee: Map<number, number> };
}) {
  const t = useT();

  const chips: { key: AssigneeFilter; label: string; count: number }[] = [
    { key: 'all', label: t('tasks.filter.all'), count: counts.all },
    { key: 'me', label: t('tasks.filter.mine'), count: counts.mine },
    ...team.map((member) => ({
      key: String(member.id),
      label: member.name,
      count: counts.byAssignee.get(member.id) ?? 0,
    })),
  ];

  return (
    // Same flexGrow:0 guard as the planning lane row: a horizontal ScrollView
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
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          count={chip.count}
          active={chip.key === value}
          onPress={() => onChange(chip.key)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : {}}
      className="flex-row items-center gap-2 rounded-full px-4 py-2"
      style={{ backgroundColor: active ? c.foreground : c.muted }}
    >
      <Text
        className="text-sm font-medium"
        numberOfLines={1}
        style={{ color: active ? c.background : c.foreground, maxWidth: 140 }}
      >
        {label}
      </Text>
      {count > 0 ? (
        <View
          className="rounded-full px-1.5"
          style={{ backgroundColor: active ? c.background : c.card }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: active ? c.foreground : c.mutedForeground }}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
