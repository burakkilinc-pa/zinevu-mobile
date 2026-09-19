import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { formatCount, formatPercent } from '@/features/form-analytics/format';
import { Section, SectionState } from '@/features/form-analytics/components/section';
import type { BreakdownRow } from '@/features/form-analytics/types';

/**
 * Where the period's visits came from, or what they came on — one row per
 * bucket, busiest first as the API orders them.
 *
 * A share bar per row instead of the web's donut: at phone width a donut with
 * a legend costs more room than the bars and reads worse, and every row also
 * says its own count, so the split survives a screenshot in a group chat. The
 * requests and conversion rate sit underneath — which source brings visitors
 * and which one brings customers are two different answers.
 */
export function BreakdownCard({
  title,
  rows,
  label,
  icon,
  limit = 6,
  restLabel,
}: {
  title: string;
  rows: BreakdownRow[];
  label: (key: string) => string;
  icon?: (key: string) => keyof typeof Ionicons.glyphMap;
  /** Rows shown; the long tail is summed into one line. */
  limit?: number;
  /** "{n} other sources" — required when the list can run past `limit`. */
  restLabel?: (count: number) => string;
}) {
  const t = useT();
  const c = useColors();

  const total = rows.reduce((sum, row) => sum + row.visits, 0);
  const shown = rows.slice(0, limit);
  const rest = rows.length - shown.length;

  return (
    <Section title={title}>
      {rows.length === 0 || total === 0 ? (
        <SectionState kind="empty" message={t('formAnalytics.empty')} />
      ) : (
        <Card className="gap-4 p-4">
          {shown.map((row) => {
            const share = (row.visits / total) * 100;

            return (
              <View key={row.key} className="gap-1.5">
                <View className="flex-row items-baseline gap-2">
                  {icon ? (
                    <Ionicons name={icon(row.key)} size={14} color={c.mutedForeground} />
                  ) : null}
                  <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                    {label(row.key)}
                  </Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatCount(row.visits)}
                  </Text>
                  <Text className="w-14 text-right text-xs text-muted-foreground">
                    {formatPercent(share)}
                  </Text>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <View className="h-1.5 rounded-full bg-primary" style={{ width: `${share}%` }} />
                </View>
                <Text className="text-xs text-muted-foreground">
                  {t('formAnalytics.breakdown.requests', { n: formatCount(row.conversions) })}
                  {' · '}
                  {formatPercent(row.conversionRate)}
                </Text>
              </View>
            );
          })}
          {rest > 0 && restLabel ? (
            <Text className="text-xs text-muted-foreground">{restLabel(rest)}</Text>
          ) : null}
        </Card>
      )}
    </Section>
  );
}
