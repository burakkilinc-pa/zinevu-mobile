import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useChatCustomers } from '@/features/chat/hooks/use-chat';
import type { ChatCustomer } from '@/features/chat/types';
import type { ChatFilter } from '@/features/chat/api/chat.api';

/**
 * The chat inbox — one row per PERSON, not per thread.
 *
 * Somebody who asked twice from two devices is one person with two
 * conversations; three rows for them is three chances to reply without knowing
 * what was already said. The row shows how many threads and how many offers
 * they have, so the dealer opens a conversation already knowing who they are
 * talking to.
 */

const FILTERS: ChatFilter[] = ['awaiting', 'open', 'all'];

export default function ChatListScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();
  const user = useAuthStore((s) => s.user);

  // Opens on "awaiting": the only slice with a clock on it. An open thread
  // somebody already answered is not waiting for anything.
  const [filter, setFilter] = useState<ChatFilter>('awaiting');
  const query = useChatCustomers(filter);

  if (!hasPermission(user, PERMISSIONS.chatView)) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('chat.noAccess.title')}
        subtitle={t('chat.noAccess.body')}
      />
    );
  }

  const customers = query.data ?? [];

  return (
    <Screen padded={false} edges={['top']}>
      <View className="px-5 pb-2 pt-1">
        <Text className="text-2xl font-bold text-foreground">{t('tabs.chat')}</Text>
      </View>

      <View className="flex-row gap-2 px-5 pb-2">
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              className="rounded-full px-4 py-1.5"
              style={{ backgroundColor: active ? c.foreground : c.muted }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? c.background : c.foreground }}
              >
                {t(`chat.filter.${f}` as MessageKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlashList
        data={customers}
        keyExtractor={(person) => person.key}
        contentContainerStyle={{ paddingBottom: bottom }}
        renderItem={({ item }) => (
          <CustomerRow
            person={item}
            onPress={() => {
              // Open the thread that needs an answer; failing that, the most
              // recent one. Never a picker — a person with two threads still
              // has one obvious next thing to read.
              const thread =
                item.conversations.find((conv) => conv.awaitingReply) ?? item.conversations[0];
              if (thread) router.push(`/chat/${thread.uuid}`);
            }}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={c.mutedForeground}
          />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <View className="py-16">
              <ActivityIndicator color={c.mutedForeground} />
            </View>
          ) : (
            <View className="items-center gap-2 py-16">
              <Ionicons name="chatbubbles-outline" size={26} color={c.mutedForeground} />
              <Text className="text-base text-muted-foreground">
                {query.isError ? t('common.error') : t(`chat.empty.${filter}` as MessageKey)}
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

function CustomerRow({ person, onPress }: { person: ChatCustomer; onPress: () => void }) {
  const t = useT();
  const c = useColors();

  const name = person.name || person.email || person.phone || t('chat.anonymous');
  const latest = person.conversations[0];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-border px-5 py-3.5 active:bg-muted"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: c.muted }}
      >
        <Text className="text-base font-semibold text-foreground">
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {relativeTime(person.lastMessageAt)}
          </Text>
        </View>

        <Text
          className="text-sm text-muted-foreground"
          numberOfLines={1}
          style={person.awaitingReply ? { color: c.foreground } : undefined}
        >
          {latest?.preview || t('chat.noMessages')}
        </Text>

        {/* What makes this row worth grouping: how many conversations, and how
            many quotes are on the table. */}
        <View className="mt-0.5 flex-row items-center gap-3">
          {person.conversations.length > 1 ? (
            <Badge
              icon="chatbubbles-outline"
              label={t('chat.threadCount', { n: person.conversations.length })}
            />
          ) : null}
          {person.offers.length > 0 ? (
            <Badge
              icon="document-text-outline"
              label={t('chat.offerCount', { n: person.offers.length })}
            />
          ) : null}
        </View>
      </View>

      {person.unread > 0 ? (
        <View
          className="min-w-6 items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: c.destructive }}
        >
          <Text className="text-xs font-bold text-white">{person.unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Badge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const c = useColors();

  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name={icon} size={11} color={c.mutedForeground} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
