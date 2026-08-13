import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useLeads, tabCount } from '@/features/leads/hooks/use-leads';
import { LEAD_TABS, type LeadTab } from '@/features/leads/types';
import { LeadCard } from '@/features/leads/components/lead-card';
import { FilterTabs } from '@/features/leads/components/filter-tabs';
import { NewLeadButton } from '@/features/leads/components/new-lead-button';

/**
 * Every request, newest first, filtered by where it sits in the funnel.
 *
 * Opens on "new" because that is the only tab with a deadline — a lead nobody
 * answered is the one thing on this screen that gets worse while you look at
 * something else.
 */
export default function LeadsScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<LeadTab>('new');
  const query = useLeads(tab);

  const leads = useMemo(
    () => query.data?.pages.flatMap((p) => p.leads) ?? [],
    [query.data]
  );

  // Every page carries the same dimension-aware totals, so the first one is
  // read for the badges — it is the page that is always there.
  const counts = query.data?.pages[0]?.counts;
  const tabCounts = useMemo(
    () =>
      Object.fromEntries(LEAD_TABS.map((k) => [k, tabCount(counts, k)])) as Record<
        LeadTab,
        number
      >,
    [counts]
  );

  if (!hasPermission(user, PERMISSIONS.leadsView)) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('leads.noAccess.title')}
        subtitle={t('leads.noAccess.body')}
      />
    );
  }

  const canCreate = hasPermission(user, PERMISSIONS.leadsManage);

  return (
    <Screen padded={false} edges={['top']}>
      <View className="px-5 pb-2 pt-1">
        <Text className="text-2xl font-bold text-foreground">{t('tabs.leads')}</Text>
      </View>

      <FilterTabs value={tab} onChange={setTab} counts={tabCounts} />

      <FlashList
        data={leads}
        keyExtractor={(lead) => lead.ref}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottom + 72 }}
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => router.push(`/leads/${item.ref}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={c.mutedForeground}
          />
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={c.mutedForeground} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          query.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color={c.mutedForeground} />
            </View>
          ) : (
            <View className="items-center gap-2 py-16">
              <Ionicons name="albums-outline" size={26} color={c.mutedForeground} />
              <Text className="text-base text-muted-foreground">
                {query.isError ? t('common.error') : t(`leads.empty.${tab}` as MessageKey)}
              </Text>
            </View>
          )
        }
      />

      {/* Creating a lead is a write — a marketing seat reads the list but
          never adds to it. */}
      {canCreate ? <NewLeadButton /> : null}
    </Screen>
  );
}
