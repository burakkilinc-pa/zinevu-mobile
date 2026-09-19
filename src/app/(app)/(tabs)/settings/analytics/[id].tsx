import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Placeholder } from '@/components/ui/placeholder';
import { Screen, useDockClearance } from '@/components/ui/screen';
import { ApiError } from '@/lib/api/client';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { clockTime, formatDateTime } from '@/lib/time';
import { useAuthStore } from '@/features/auth/store';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  useCachedVisit,
  useCanViewAnalytics,
  useNow,
  useScreenVisible,
  useSessionTimeline,
} from '@/features/form-analytics/hooks/use-form-analytics';
import { decayStatus, formatDuration } from '@/features/form-analytics/format';
import { SectionState } from '@/features/form-analytics/components/section';
import { StatusLabel } from '@/features/form-analytics/components/visit-row';
import { useAnalyticsVocabulary } from '@/features/form-analytics/vocabulary';
import type { TimelineEvent, Visit } from '@/features/form-analytics/types';

/**
 * One visit, event by event — what they looked at, what they picked, where it
 * went wrong, and where they stopped.
 *
 * Opened from a recent visit or a live one. The journal is the whole payload
 * of its endpoint; the summary above it is the row the dealer tapped, read
 * back from the list's cache (see useCachedVisit), so it is simply left out
 * when the screen is reached without one.
 */
export default function VisitTimelineScreen() {
  const t = useT();
  const allowed = useCanViewAnalytics();

  if (!allowed) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('formAnalytics.noAccess.title')}
        subtitle={t('formAnalytics.noAccess.body')}
      />
    );
  }

  return <VisitTimelineBody />;
}

function VisitTimelineBody() {
  const t = useT();
  const c = useColors();
  const bottom = useDockClearance();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = typeof id === 'string' ? id : '';

  const query = useSessionTimeline(sessionId);
  const visit = useCachedVisit(sessionId);
  const events = query.data ?? [];

  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const notFound = query.error instanceof ApiError && query.error.status === 404;

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('formAnalytics.timeline.title')} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottom, gap: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
            tintColor={c.mutedForeground}
          />
        }
      >
        {visit ? <VisitSummary visit={visit} /> : null}

        {query.isLoading ? (
          <SectionState kind="loading" />
        ) : notFound ? (
          <SectionState kind="empty" message={t('formAnalytics.timeline.notFound')} />
        ) : query.isError && !query.data ? (
          <SectionState
            kind="error"
            message={t('formAnalytics.error')}
            onRetry={() => void query.refetch()}
          />
        ) : events.length === 0 ? (
          <SectionState kind="empty" message={t('formAnalytics.timeline.empty')} />
        ) : (
          <Card className="px-4 pb-1 pt-4">
            {events.map((event, index) => (
              <EventRow
                // The journal has no ids; its order is the identity.
                key={`${index}:${event.event}`}
                event={event}
                last={index === events.length - 1}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Who this was, in the terms the list used: which form, from where, how far,
 * what came of it — and, for a visit that became a lead, the way to it.
 */
function VisitSummary({ visit }: { visit: Visit }) {
  const t = useT();
  const router = useRouter();
  const words = useAnalyticsVocabulary();
  const user = useAuthStore((s) => s.user);

  // A timeline left open lets "filling in now" lapse like the list's does.
  const visible = useScreenVisible();
  const now = useNow(visible);
  const status = decayStatus(visit, now);

  const reached = words.step(visit.maxStepKey, visit.maxStepIndex);
  const leadRef = visit.lead?.ref ?? null;
  // The lead screens are behind leads.view; offering a way in that ends in a
  // 403 is worse than naming the lead and leaving it there.
  const canOpenLead = !!leadRef && hasPermission(user, PERMISSIONS.leadsView);

  const rows: { label: string; value: string }[] = [
    reached ? { label: t('formAnalytics.timeline.reached'), value: reached } : null,
    { label: t('formAnalytics.timeline.duration'), value: formatDuration(visit.durationMs, t) },
    {
      label: t('formAnalytics.timeline.device'),
      value: words.device(visit.deviceType, visit.deviceOs),
    },
    { label: t('formAnalytics.timeline.source'), value: words.source(visit.source) },
    visit.firstSeenAt
      ? { label: t('formAnalytics.timeline.arrived'), value: formatDateTime(visit.firstSeenAt) }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <Card className="gap-3 p-4">
      <View className="gap-0.5">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {words.place(visit.place)}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {[words.formType(visit.formType), words.surface(visit.surface)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-sm text-muted-foreground">{t('formAnalytics.timeline.status')}</Text>
          <StatusLabel status={status} />
        </View>
        {rows.map((row) => (
          <View key={row.label} className="flex-row items-baseline justify-between gap-3">
            <Text className="text-sm text-muted-foreground">{row.label}</Text>
            <Text className="flex-1 text-right text-sm text-foreground" numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      {visit.lead ? (
        canOpenLead ? (
          <Button
            title={`${t('formAnalytics.timeline.openLead')} · ${visit.lead.label}`}
            variant="outline"
            icon="albums-outline"
            onPress={() => {
              if (leadRef) router.push(`/leads/${leadRef}`);
            }}
          />
        ) : (
          <Text className="text-sm font-medium text-foreground">{visit.lead.label}</Text>
        )
      ) : visit.leadDeleted ? (
        <Text className="text-sm text-muted-foreground">{t('formAnalytics.leadDeleted')}</Text>
      ) : null}
    </Card>
  );
}

/**
 * The dot a journal row wears. The send and a refused send are the two rows a
 * dealer scrolls for, so only those two — and leaving — get a colour.
 */
function dotClass(event: string): string {
  switch (event) {
    case 'submit':
      return 'bg-success';
    case 'error':
      return 'bg-destructive';
    case 'abandon':
      return 'bg-warning';
    case 'option_select':
      return 'bg-primary';
    default:
      return 'bg-muted-foreground/40';
  }
}

/**
 * One journal row, named in words.
 *
 * An answer is written out in full ("Right side: Sliding glass walls") with the
 * step it was given on underneath — the front and the back ask one step per
 * bay, so the step is what tells bay 1 from bay 2. Every other row is the
 * event with the step it happened on. A refused send carries the field and the
 * reason the server named: "Hit an error" on its own leaves the dealer no wiser
 * than the visitor was.
 */
function EventRow({ event, last }: { event: TimelineEvent; last: boolean }) {
  const t = useT();
  const words = useAnalyticsVocabulary();

  const step = words.step(event.stepKey);
  const answer = event.event === 'option_select' ? words.option(event.field, event.value) : null;
  const title = answer ?? [words.event(event.event), step].filter(Boolean).join(' · ');
  const failure =
    event.event === 'error'
      ? [event.field, event.reason, event.errorStatus].filter(Boolean).join(' · ')
      : '';

  return (
    <View className="flex-row gap-3">
      {/* The rail: a dot per event and a hairline down to the next one. */}
      <View className="w-3 items-center">
        <View className={cn('mt-1.5 h-2.5 w-2.5 rounded-full', dotClass(event.event))} />
        {last ? null : <View className="mt-1 w-px flex-1 bg-border" />}
      </View>

      <View className="flex-1 gap-0.5 pb-4">
        <Text className="text-sm font-medium text-foreground">{title}</Text>
        {answer && step ? <Text className="text-xs text-muted-foreground">{step}</Text> : null}
        {failure ? <Text className="text-xs text-destructive">{failure}</Text> : null}
        <Text className="text-xs text-muted-foreground">
          {[formatDuration(event.tMs, t), clockTime(event.at)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}
