import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { relativeTime } from '@/lib/time';
import { formatDuration } from '@/features/form-analytics/format';
import { deviceIcon, useAnalyticsVocabulary } from '@/features/form-analytics/vocabulary';
import type { Visit, VisitStatus } from '@/features/form-analytics/types';

/**
 * Which dot a status wears. Only two states earn a colour of their own: a
 * request (the goal) and a visit that got going and then stopped (the one
 * worth asking why about). "Filling in now" takes the brand colour — it is the
 * row a dealer might still act on, and nothing has been won yet.
 */
const STATUS_DOT: Record<VisitStatus, string> = {
  converted: 'bg-success',
  active: 'bg-primary',
  looking: 'bg-primary/40',
  abandoned: 'bg-warning',
  bounced: 'bg-muted-foreground/40',
};

/**
 * A status as a dot and its word. The word carries the meaning; the dot is for
 * scanning a list, so colour is never the only signal.
 */
export function StatusLabel({ status }: { status: VisitStatus }) {
  const words = useAnalyticsVocabulary();

  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
      <Text className="text-xs font-medium text-foreground">{words.status(status)}</Text>
    </View>
  );
}

/**
 * One visit in a list: where from, which form and how far, what came of it.
 *
 * Leads with the place because that is the only thing that tells two
 * anonymous visits apart at a glance; the IP the web groups by is deliberately
 * not shown on a phone. The status is passed in rather than read off the
 * visit, because the caller re-judges it against the clock (see decayStatus).
 */
export function VisitRow({
  visit,
  status,
  onPress,
  divider,
}: {
  visit: Visit;
  status: VisitStatus;
  onPress: () => void;
  /** Hairline above the row — every row but the first in a card. */
  divider: boolean;
}) {
  const t = useT();
  const c = useColors();
  const words = useAnalyticsVocabulary();

  const form = words.formType(visit.formType);
  const reached = words.step(visit.maxStepKey, visit.maxStepIndex);
  const detail = [form, reached ? t('formAnalytics.visits.reached', { step: reached }) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn('flex-row items-center gap-3 px-4 py-3 active:bg-muted', divider && 'border-t border-border')}
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-muted">
        <Ionicons name={deviceIcon(visit.deviceType)} size={17} color={c.foreground} />
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
            {words.place(visit.place)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {relativeTime(visit.lastSeenAt ?? visit.firstSeenAt)}
          </Text>
        </View>
        {detail ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          <StatusLabel status={status} />
          <Text className="text-xs text-muted-foreground">
            {formatDuration(visit.durationMs, t)}
          </Text>
          {/* The lead sits beside its status: "converted" and the number it
              converted into are one fact. A deleted lead is said, because
              otherwise this row shows a conversion the totals no longer count. */}
          {visit.lead ? (
            <Text className="text-xs font-medium text-foreground">{visit.lead.label}</Text>
          ) : visit.leadDeleted ? (
            <Text className="text-xs" style={{ color: c.warning }}>
              {t('formAnalytics.leadDeleted')}
            </Text>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
    </Pressable>
  );
}
