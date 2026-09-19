import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { formatCount } from '@/features/form-analytics/format';
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from '@/features/form-analytics/types';

/**
 * 7 / 30 / 90 days — the web dashboard's three pills.
 *
 * Three equal segments rather than the scrolling chip row the leads filter
 * uses: "{n} days" is short in all five languages, and a fixed row keeps the
 * selected period in the same place under the thumb.
 *
 * The spinner is for the moment between a tap and the new period's answer:
 * the previous figures stay on screen meanwhile (see useFormAnalytics), and
 * without a sign that something is coming they would read as the new ones.
 */
export function PeriodSwitch({
  value,
  onChange,
  loading = false,
}: {
  value: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
  loading?: boolean;
}) {
  const t = useT();
  const c = useColors();

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 flex-row gap-1 rounded-full bg-muted p-1">
        {ANALYTICS_PERIODS.map((period) => {
          const active = period === value;

          return (
            <Pressable
              key={period}
              onPress={() => onChange(period)}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              className={cn(
                'flex-1 items-center rounded-full py-2',
                active ? 'bg-foreground' : 'active:opacity-70'
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  active ? 'text-background' : 'text-foreground'
                )}
              >
                {t('formAnalytics.period', { n: formatCount(period) })}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Fixed width either way, so the segments don't shift when it appears. */}
      <View className="w-5 items-center">
        {loading ? <ActivityIndicator size="small" color={c.mutedForeground} /> : null}
      </View>
    </View>
  );
}
