import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useColors } from '@/lib/theme';
import { useDashboard, useLiveVisitors } from '@/features/dashboard/hooks/use-dashboard';
import { StatTile } from '@/features/dashboard/components/stat-tile';
import { ActionList } from '@/features/dashboard/components/action-list';
import { VisitorList } from '@/features/dashboard/components/visitor-list';
import {
  ConversionFunnel,
  MonthlyLeadsChart,
  SourceSplit,
} from '@/features/dashboard/components/charts';

/**
 * The office landing screen: what came in today, and what is waiting.
 *
 * Deliberately short. Today's figures and the waiting work come first; three
 * small charts sit under them for the "how are we doing" question. What stays
 * on the web is revenue, pipeline value and a period picker — a phone is opened
 * between other things, and a screen you have to study is a screen you stop
 * opening.
 */
export default function DashboardScreen() {
  const t = useT();
  const c = useColors();
  const bottom = useDockClearance();
  const user = useAuthStore((s) => s.user);
  const account = useAuthStore((s) => s.account);

  const dashboard = useDashboard();
  const visitors = useLiveVisitors();

  // Only a pull drives the spinner. The visitor list polls every 30s, and
  // bound to `isRefetching` that poll shows the control on its own.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      await Promise.all([dashboard.refetch(), visitors.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const canSeeVisitors = hasPermission(user, PERMISSIONS.chatView);

  // A member without analytics.view gets a 403 from the endpoint, so say why
  // rather than spin forever on a request that will never succeed.
  if (!hasPermission(user, PERMISSIONS.analyticsView)) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('dash.noAccess.title')}
        subtitle={t('dash.noAccess.body')}
      />
    );
  }

  const summary = dashboard.data;

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
            tintColor={c.mutedForeground}
          />
        }
      >
        <View className="mb-5">
          <Text className="text-2xl font-bold text-foreground">
            {user?.name
              ? t('dash.greetingNamed', { name: user.name.split(' ')[0] })
              : t('dash.greeting')}
          </Text>
          {/* Their OWN company, not the account: one account can carry a dozen
              dealers behind a single white-label brand, so account.name would
              greet a Valk Veranda user with the reseller's name. Only when the
              user has no company of their own (assembler crew, platform staff)
              does the branded account name stand in. */}
          {user?.company?.name ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">{user.company.name}</Text>
          ) : account?.branded ? (
            <Text className="mt-0.5 text-sm text-muted-foreground">{account.name}</Text>
          ) : null}
        </View>

        {dashboard.isError ? (
          <Text className="mb-4 text-sm text-destructive">{t('common.error')}</Text>
        ) : null}

        <View className="mb-3 flex-row gap-3">
          <StatTile
            label={t('dash.tile.leadsToday')}
            icon="albums-outline"
            metric={summary?.leadsToday}
          />
          <StatTile
            label={t('dash.tile.offersSent')}
            icon="paper-plane-outline"
            metric={summary?.offersSentToday}
          />
        </View>

        <View className="mb-6 flex-row gap-3">
          <StatTile
            label={t('dash.tile.visitors')}
            icon="eye-outline"
            value={summary?.visitorsToday.value ?? 0}
            compareLabel={t('dash.today')}
          />
          <StatTile
            label={t('dash.tile.requests')}
            icon="checkmark-done-outline"
            value={summary?.requestsToday ?? 0}
            compareLabel={t('dash.today')}
          />
        </View>

        <Text className="mb-2 text-base font-semibold text-foreground">
          {t('dash.actions.title')}
        </Text>
        <View className="mb-6">
          <ActionList actions={summary?.actions ?? []} />
        </View>

        {/* Below the fold on purpose: the tiles and the action list are what the
            screen is opened for, and the trend is what you look at once you are
            already here. Each chart hides itself when its numbers are all zero,
            so a dealer in their first week doesn't scroll past three empty
            frames. */}
        {summary ? (
          <View className="mb-6 gap-3">
            <MonthlyLeadsChart months={summary.monthly} />
            <ConversionFunnel conversion={summary.conversion30d} />
            <SourceSplit sources={summary.sources30d} />
          </View>
        ) : null}

        {canSeeVisitors ? (
          <>
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text className="text-base font-semibold text-foreground">
                {t('dash.visitors.title')}
              </Text>
              {visitors.data?.length ? (
                <Text className="text-sm text-muted-foreground">{visitors.data.length}</Text>
              ) : null}
            </View>
            <VisitorList visitors={visitors.data ?? []} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
