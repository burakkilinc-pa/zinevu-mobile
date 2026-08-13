import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import type { Metric } from '@/features/dashboard/types';

/**
 * One headline figure: a label, the number, and how it compares to the same
 * window before it.
 *
 * The delta is coloured by DIRECTION × whether up is good, not by sign — every
 * figure on this dashboard is a "more is better" one, but stating the rule here
 * keeps the next one (cancellations, say) from being coloured backwards. It is
 * also never colour alone: an arrow carries the same information for anyone who
 * can't separate the two greens from the reds.
 *
 * No sparkline. A twelve-point trend is on the API, but at this tile size it
 * would be four pixels tall and decorative — the number is the message.
 */
export function StatTile({
  label,
  metric,
  value,
  icon,
  compareLabel,
}: {
  label: string;
  /** Pass a Metric to get the comparison, or a bare value for a figure that has none. */
  metric?: Metric;
  value?: number;
  icon: keyof typeof Ionicons.glyphMap;
  /** Names the window being compared against, e.g. "vs yesterday". */
  compareLabel?: string;
}) {
  const t = useT();
  const c = useColors();

  const current = metric?.value ?? value ?? 0;
  const previous = metric?.previous;
  const delta = previous === undefined ? null : current - previous;

  return (
    <Card className="flex-1 gap-2 p-4">
      <View className="flex-row items-center gap-1.5">
        <Ionicons name={icon} size={14} color={c.mutedForeground} />
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>

      {/* Proportional figures on purpose: tabular-nums gives every digit the
          width of a zero, which reads loose at this size. */}
      <Text className="text-3xl font-bold text-foreground">{current}</Text>

      {delta !== null && delta !== 0 ? (
        <View className="flex-row items-center gap-1">
          <Ionicons
            name={delta > 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={delta > 0 ? c.success : c.mutedForeground}
          />
          <Text
            className="text-xs"
            style={{ color: delta > 0 ? c.success : c.mutedForeground }}
          >
            {Math.abs(delta)}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {compareLabel ?? t('dash.vsYesterday')}
          </Text>
        </View>
      ) : (
        // Reserve the row even with nothing to say, so tiles in a pair keep
        // their numbers on the same line.
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {compareLabel ?? t('dash.vsYesterday')}
        </Text>
      )}
    </Card>
  );
}
