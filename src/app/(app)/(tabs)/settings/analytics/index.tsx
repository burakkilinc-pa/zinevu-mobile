import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  formAnalyticsKeys,
  resolveRange,
  useCanViewAnalytics,
  useFormAnalytics,
  useLiveFormVisitors,
  useNow,
  useScreenVisible,
} from '@/features/form-analytics/hooks/use-form-analytics';
import { formatCount } from '@/features/form-analytics/format';
import { deviceIcon, useAnalyticsVocabulary } from '@/features/form-analytics/vocabulary';
import { BreakdownCard } from '@/features/form-analytics/components/breakdown-card';
import { KpiGrid } from '@/features/form-analytics/components/kpi-grid';
import { LiveNowCard } from '@/features/form-analytics/components/live-now';
import { PeriodSwitch } from '@/features/form-analytics/components/period-switch';
import { Section, SectionState } from '@/features/form-analytics/components/section';
import { StepFunnelSection } from '@/features/form-analytics/components/step-funnel';
import { VisitList } from '@/features/form-analytics/components/visit-list';
import type { AnalyticsPeriod } from '@/features/form-analytics/types';

/**
 * Form analytics — how the dealer's public funnels are doing.
 *
 * The phone's cut of the portal's analytics page: who is on a form right now,
 * the period's four headline figures, one form's step drop-off, where the
 * traffic came from, and the latest visits, each of which opens its own
 * timeline. What stays on the web is what you study at a desk: the daily
 * chart, the surface and entry tables, the IP ignore rules, the export.
 *
 * Reached from the More sheet, and only with `analytics.view`.
 */
export default function FormAnalyticsScreen() {
  const t = useT();
  const allowed = useCanViewAnalytics();

  // A member without the capability gets a 403 from every endpoint here, so
  // say why rather than spinning on requests that can never succeed. The
  // More sheet hides the way in; this covers a permission revoked mid-session.
  if (!allowed) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('formAnalytics.noAccess.title')}
        subtitle={t('formAnalytics.noAccess.body')}
      />
    );
  }

  return <FormAnalyticsBody />;
}

function FormAnalyticsBody() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bottom = useDockClearance();
  const words = useAnalyticsVocabulary();

  const [days, setDays] = useState<AnalyticsPeriod>(30);

  // One clock for the screen: it moves the window at midnight and lets the
  // "filling in now" badges lapse, and it only ticks while the screen is seen.
  const visible = useScreenVisible();
  const now = useNow(visible);
  const range = resolveRange(days, new Date(now));

  const overview = useFormAnalytics(range);
  const live = useLiveFormVisitors();

  // Only a pull drives the spinner — the live panel polls every 15s, and a
  // spinner bound to `isRefetching` would flash for each of those.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      // Every analytics read on screen — overview, the open funnel, the live
      // panel — in one go, without this screen having to hold each query.
      await queryClient.invalidateQueries({ queryKey: formAnalyticsKeys.all });
    } finally {
      setPulling(false);
    }
  };

  const openVisit = (sessionId: string) =>
    router.push(`/settings/analytics/${sessionId}`);

  const data = overview.data;

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('formAnalytics.title')} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottom, gap: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
            tintColor={c.mutedForeground}
          />
        }
      >
        <LiveNowCard
          live={live.data}
          loading={live.isLoading}
          error={live.isError}
          onRetry={() => void live.refetch()}
          onOpen={openVisit}
        />

        <View className="gap-4">
          <PeriodSwitch
            value={days}
            onChange={setDays}
            loading={overview.isPlaceholderData && overview.isFetching}
          />

          {!data ? (
            overview.isError ? (
              <SectionState
                kind="error"
                message={t('formAnalytics.error')}
                onRetry={() => void overview.refetch()}
              />
            ) : (
              <SectionState kind="loading" />
            )
          ) : data.totals.visits === 0 ? (
            // One empty state for the whole period rather than five: with no
            // visits every block below would say the same thing in turn.
            <SectionState
              kind="empty"
              message={t('formAnalytics.empty')}
              hint={t('formAnalytics.emptyHint')}
            />
          ) : (
            <View className="gap-2">
              <KpiGrid totals={data.totals} previous={data.previous} />
              <Text className="text-xs text-muted-foreground">
                {t('formAnalytics.vsPrevious', { n: formatCount(days) })}
              </Text>
              {/* What the rules took out of the numbers above, said out loud:
                  a screen that silently reports fewer visitors than the dealer
                  knows they had is worse than one that reports too many. */}
              {data.hiddenBotVisits > 0 ? (
                <Text className="text-xs text-muted-foreground">
                  {t('formAnalytics.hidden.bots', { n: formatCount(data.hiddenBotVisits) })}
                </Text>
              ) : null}
              {data.hiddenIgnoredVisits > 0 ? (
                <Text className="text-xs text-muted-foreground">
                  {t('formAnalytics.hidden.ignored', { n: formatCount(data.hiddenIgnoredVisits) })}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {data && data.totals.visits > 0 ? (
          <>
            <StepFunnelSection range={range} forms={data.forms} />

            <BreakdownCard
              title={t('formAnalytics.sources.title')}
              rows={data.sources}
              label={words.source}
              restLabel={(n) => t('formAnalytics.breakdown.rest', { n: formatCount(n) })}
            />

            <BreakdownCard
              title={t('formAnalytics.devices.title')}
              rows={data.devices}
              label={(key) => words.device(key)}
              icon={deviceIcon}
            />

            <Section title={t('formAnalytics.visits.title')} note={t('formAnalytics.visits.hint')}>
              {data.visits.length > 0 ? (
                <VisitList visits={data.visits} now={now} onOpen={openVisit} />
              ) : (
                <SectionState kind="empty" message={t('formAnalytics.empty')} />
              )}
            </Section>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
