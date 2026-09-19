import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { formatCount, formatDuration } from '@/features/form-analytics/format';
import { deviceIcon, useAnalyticsVocabulary } from '@/features/form-analytics/vocabulary';
import type { LiveSnapshot } from '@/features/form-analytics/types';

/** Rows shown under the count; the rest are summed into "+n more". */
const MAX_ROWS = 5;

/**
 * Who is on a form at this second.
 *
 * Presence comes from a heartbeat the tracker sends every 20s while the tab is
 * visible, so an empty card means empty — not "nothing to report yet". The
 * count is what a dealer glances at; the rows are for when it isn't zero, and
 * each opens that visit's timeline so far.
 *
 * Sits above the period switch on purpose: "now" is not a period, and a dealer
 * looking at the 90-day view still means now.
 */
export function LiveNowCard({
  live,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  live: LiveSnapshot | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpen: (sessionId: string) => void;
}) {
  const t = useT();
  const c = useColors();
  const words = useAnalyticsVocabulary();

  const count = live?.count ?? 0;
  const rows = live?.visits.slice(0, MAX_ROWS) ?? [];
  const rest = Math.max(0, count - rows.length);

  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
        {/* A dot alone would be colour-only; the count beside it says the same. */}
        <View className={cn('h-2.5 w-2.5 rounded-full', count > 0 ? 'bg-success' : 'bg-muted-foreground/40')} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground">
            {t('formAnalytics.live.title')}
          </Text>
          <Text className="text-xs text-muted-foreground">{t('formAnalytics.live.hint')}</Text>
        </View>
        {live ? (
          <Text className="text-3xl font-bold text-foreground">{formatCount(count)}</Text>
        ) : loading ? (
          <ActivityIndicator color={c.mutedForeground} />
        ) : null}
      </View>

      {/* Only when there is no earlier answer to keep showing: one failed
          15-second poll must not blank a panel that was right a moment ago. */}
      {error && !live ? (
        <View className="items-center gap-2 border-t border-border px-4 py-4">
          <Text className="text-center text-sm text-destructive">{t('formAnalytics.error')}</Text>
          <Button
            title={t('common.retry')}
            variant="outline"
            icon="refresh"
            onPress={onRetry}
            className="h-10"
          />
        </View>
      ) : live && count === 0 ? (
        <View className="border-t border-border px-4 py-3">
          <Text className="text-sm text-muted-foreground">{t('formAnalytics.live.empty')}</Text>
        </View>
      ) : (
        rows.map((visit) => {
          const step = words.step(visit.maxStepKey, visit.maxStepIndex);
          const form = words.formType(visit.formType);

          return (
            <Pressable
              key={visit.sessionId}
              onPress={() => onOpen(visit.sessionId)}
              accessibilityRole="button"
              className="flex-row items-center gap-3 border-t border-border px-4 py-3 active:bg-muted"
            >
              <Ionicons name={deviceIcon(visit.deviceType)} size={16} color={c.mutedForeground} />
              <View className="flex-1">
                {/* Where they are in the form first: it is the only thing that
                    makes one anonymous visitor worth a second look. */}
                <Text className="text-[15px] text-foreground" numberOfLines={1}>
                  {step ?? t('formAnalytics.live.justArrived')}
                </Text>
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {[words.place(visit.place), form, words.source(visit.source)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {formatDuration(visit.durationMs, t)}
              </Text>
            </Pressable>
          );
        })
      )}

      {rest > 0 && !(error && !live) ? (
        <View className="border-t border-border px-4 py-2.5">
          <Text className="text-xs text-muted-foreground">
            {t('formAnalytics.live.more', { n: formatCount(rest) })}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
