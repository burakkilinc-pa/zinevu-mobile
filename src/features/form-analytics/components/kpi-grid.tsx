import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import {
  countDelta,
  formatCount,
  formatPercent,
  pointDelta,
  type Delta,
} from '@/features/form-analytics/format';
import type { FormTotals, PreviousTotals } from '@/features/form-analytics/types';

/**
 * The four headline figures, two by two.
 *
 * Named exactly as the web names them — Visitors, Started, Conversions,
 * Conversion rate — so a dealer comparing the phone with the portal is reading
 * the same four words. Each one says what it is a share of underneath, because
 * the four count different things on purpose (people, their visits, the visits
 * that did something, the requests) and four numbers that don't add up to each
 * other otherwise read as a broken page.
 *
 * The web shows two more tiles (page views, median time); they answer "why
 * does this differ from Google Analytics", which is a desk question.
 */
export function KpiGrid({
  totals,
  previous,
}: {
  totals: FormTotals;
  previous: PreviousTotals | null;
}) {
  const t = useT();

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <KpiCard
          label={t('formAnalytics.kpi.visitors')}
          value={formatCount(totals.visitors)}
          hint={t('formAnalytics.kpi.visitsHint', { n: formatCount(totals.visits) })}
          delta={countDelta(totals.visitors, previous?.visitors, t)}
        />
        <KpiCard
          label={t('formAnalytics.kpi.started')}
          value={formatCount(totals.starts)}
          hint={t('formAnalytics.kpi.startedHint', { rate: formatPercent(totals.startRate) })}
          delta={countDelta(totals.starts, previous?.starts, t)}
        />
      </View>
      <View className="flex-row gap-3">
        <KpiCard
          label={t('formAnalytics.kpi.conversions')}
          value={formatCount(totals.conversions)}
          hint={t('formAnalytics.kpi.conversionsHint', { n: formatCount(totals.abandons) })}
          // Said out loud rather than quietly subtracted: the dealer knows they
          // deleted something, and a number that shrinks without a reason
          // reads as a bug in either this screen or their lead list.
          note={
            totals.deletedConversions > 0
              ? t('formAnalytics.kpi.deleted', { n: formatCount(totals.deletedConversions) })
              : undefined
          }
          delta={countDelta(totals.conversions, previous?.conversions, t)}
        />
        <KpiCard
          label={t('formAnalytics.kpi.conversionRate')}
          value={formatPercent(totals.conversionRate)}
          hint={t('formAnalytics.kpi.perVisitor', {
            rate: formatPercent(totals.visitorConversionRate),
          })}
          delta={pointDelta(totals.conversionRate, previous?.conversionRate, t)}
        />
      </View>
    </View>
  );
}

/**
 * One figure. The change is coloured the way the dashboard's tiles colour
 * theirs — up in the success colour, down in the quiet one — and is never
 * colour alone: the arrow says the same thing to anyone who can't tell the
 * two apart.
 */
function KpiCard({
  label,
  value,
  hint,
  note,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  note?: string;
  delta: Delta | null;
}) {
  const c = useColors();
  const tone = delta?.direction === 'up' ? c.success : c.mutedForeground;

  return (
    <Card className="flex-1 gap-1 p-4">
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      <View className="flex-row flex-wrap items-baseline gap-x-2">
        <Text className="text-2xl font-bold text-foreground">{value}</Text>
        {delta ? (
          <View className="flex-row items-center gap-0.5">
            <Ionicons
              name={
                delta.direction === 'up'
                  ? 'arrow-up'
                  : delta.direction === 'down'
                    ? 'arrow-down'
                    : 'remove'
              }
              size={11}
              color={tone}
            />
            <Text
              className={
                delta.direction === 'up'
                  ? 'text-xs font-medium text-success'
                  : 'text-xs font-medium text-muted-foreground'
              }
            >
              {delta.label}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-xs text-muted-foreground" numberOfLines={2}>
        {hint}
      </Text>
      {/* The theme's warning mirror, not the class: at 12px the class's amber
          is too light to read on a white card; the mirror is the darker one
          the planning agenda already uses for text. */}
      {note ? (
        <Text className="text-xs" style={{ color: c.warning }}>
          {note}
        </Text>
      ) : null}
    </Card>
  );
}
