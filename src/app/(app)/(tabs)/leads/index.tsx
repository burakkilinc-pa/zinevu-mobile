import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { MIN_SEARCH, useLeadCounts, useLeads, useLeadSearch } from '@/features/leads/hooks/use-leads';
import { type LeadTab } from '@/features/leads/types';
import { LeadCard } from '@/features/leads/components/lead-card';
import { FilterTabs } from '@/features/leads/components/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { NewLeadButton } from '@/features/leads/components/new-lead-button';

/**
 * Every request, newest first, filtered by where it sits in the funnel.
 *
 * Opens on "new" because that is the only tab with a deadline — a lead nobody
 * answered is the one thing on this screen that gets worse while you look at
 * something else.
 *
 * Typing in the search field swaps the board for a lookup: the chips go away and
 * the matches come from ALL four columns at once (see searchLeads), because
 * someone searching a phone number wants that person's request and does not know
 * which lane it is parked in. Clearing the field puts the board back, on the
 * same tab it was on.
 */
export default function LeadsScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<LeadTab>('new');

  // The field's own text drives the mode (instant), the settled text drives the
  // request (debounced) — so the chips disappear on the first keystroke while
  // the network waits for the typing to stop.
  const [term, setTerm] = useState('');
  const typed = term.trim();
  const searching = typed.length > 0;
  const settled = useDebounced(typed, 300);
  const results = useLeadSearch(settled);

  const query = useLeads(tab, !searching);

  const leads = useMemo(
    () => query.data?.pages.flatMap((p) => p.leads) ?? [],
    [query.data]
  );

  const { counts, refetch: refetchCounts } = useLeadCounts();

  // A term too short to ask about clears the list rather than leaving the last
  // answer sitting under a field that no longer says what produced it.
  const tooShort = searching && typed.length < MIN_SEARCH;
  const found = tooShort ? null : (results.data ?? null);
  const rows = searching ? (found?.leads ?? []) : leads;
  const matched = found?.total ?? 0;

  // Only a pull drives the spinner. Bound to `isRefetching` it also fires for
  // the refetch that happens on its own when the screen remounts — coming back
  // from a lead — and the control then hangs at the top of a list nobody pulled.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      if (searching) await results.refetch();
      else await Promise.all([query.refetch(), refetchCounts()]);
    } finally {
      setPulling(false);
    }
  };

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

      <SearchField
        value={term}
        onChange={setTerm}
        placeholder={t('leads.search.placeholder')}
        busy={searching && (results.isFetching || typed !== settled)}
      />

      {searching ? (
        // What the term found, in place of the chips it replaced. Silent until
        // an answer exists, so it never contradicts the list under it.
        <View className="px-5 py-2">
          <Text className="text-xs text-muted-foreground">
            {tooShort
              ? t('leads.search.short', { n: MIN_SEARCH })
              : found
                ? t('leads.search.results', { n: matched })
                : ''}
          </Text>
        </View>
      ) : (
        <FilterTabs value={tab} onChange={setTab} counts={counts} />
      )}

      <FlashList
        data={rows}
        style={{ flex: 1 }}
        keyExtractor={(lead) => lead.ref}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: bottom + 72 }}
        // A tap on a card while the keyboard is open must open that card, not
        // just dismiss the keyboard and make the user aim twice.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => router.push(`/leads/${item.ref}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          // Search results are one unpaged answer — see searchLeads.
          if (searching) return;
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
            tintColor={c.mutedForeground}
          />
        }
        ListFooterComponent={
          searching ? (
            // The answer was cut: say so rather than letting a scroll to the
            // bottom imply there is nothing else.
            rows.length > 0 && matched > rows.length ? (
              <View className="pb-6 pt-1">
                <Text className="text-center text-xs text-muted-foreground">
                  {t('leads.search.more', { n: rows.length, total: matched })}
                </Text>
              </View>
            ) : null
          ) : query.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={c.mutedForeground} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          searching ? (
            <SearchEmpty
              term={typed}
              loading={results.isLoading || (typed.length >= MIN_SEARCH && typed !== settled)}
              error={results.isError}
            />
          ) : query.isLoading ? (
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

/**
 * The gap between "still typing", "nothing matches" and "the request failed".
 * A search that found nothing must not look like a search that broke.
 */
function SearchEmpty({
  term,
  loading,
  error,
}: {
  term: string;
  loading: boolean;
  error: boolean;
}) {
  const t = useT();
  const c = useColors();

  if (term.length < MIN_SEARCH) return null;

  if (loading) {
    return (
      <View className="py-16">
        <ActivityIndicator color={c.mutedForeground} />
      </View>
    );
  }

  return (
    <View className="items-center gap-2 px-6 py-16">
      <Ionicons
        name={error ? 'alert-circle-outline' : 'search-outline'}
        size={26}
        color={c.mutedForeground}
      />
      <Text className="text-center text-base text-muted-foreground">
        {error ? t('common.error') : t('leads.search.empty', { q: term })}
      </Text>
    </View>
  );
}
