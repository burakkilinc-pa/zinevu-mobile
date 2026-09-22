import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Switch, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Placeholder } from '@/components/ui/placeholder';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime, relativeTime } from '@/lib/time';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useChatAvailability, useChatCustomers } from '@/features/chat/hooks/use-chat';
import { surfaceLabel } from '@/features/chat/components/customer-header';
import type { ChatCustomer } from '@/features/chat/types';

/**
 * The chat inbox — one row per PERSON, not per thread.
 *
 * Somebody who asked twice from two devices is one person with two
 * conversations; three rows for them is three chances to reply without knowing
 * what was already said. The row shows how many threads and how many offers
 * they have, so the dealer opens a conversation already knowing who they are
 * talking to.
 */


export default function ChatListScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();
  const user = useAuthStore((s) => s.user);

  /**
   * One list. No slices.
   *
   * "Waiting" and "Open" split the inbox on who happened to write last, which
   * is not a thing anybody reading their inbox is thinking about — and it
   * moved rows out from under them: a colleague takes a thread over, the last
   * line is no longer the visitor's, and the conversation the phone had just
   * buzzed about was gone from the tab they were looking at.
   *
   * `open` is everything not archived. Nothing sets `closed` yet, so today
   * that is simply everything; when archiving lands, this is the list it
   * takes rows out of, and still the only list there is.
   */
  const query = useChatCustomers('open');

  // Only a pull drives the spinner. Bound to `isRefetching` the inbox's own
  // 20s poll shows the control every twenty seconds, and it sits there until
  // that request lands — a wait nobody asked for.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

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

      <AvailabilityRow />

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
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
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
                {query.isError ? t('common.error') : t('chat.empty.all')}
              </Text>
            </View>
          )
        }
      />
    </Screen>
  );
}

/**
 * "I am reachable", and what the visitor is being told because of it.
 *
 * This is the one control on the phone that changes what a stranger on the
 * dealer's website sees, so it says so in as many words rather than leaving
 * a switch to be interpreted. Three states worth telling apart:
 *
 *   - my claim is standing → the visitor sees "online", until when,
 *   - somebody ELSE is at the desk → the visitor sees "online" anyway, and
 *     turning my switch on would add nothing,
 *   - nobody → the visitor is told we are away and asked to leave details.
 *
 * Office hours still have the last word on all three: outside them the widget
 * says offline whatever this switch is doing, which is the honest answer and
 * the reason the claim may be held for hours without lying at 3am.
 */
function AvailabilityRow() {
  const t = useT();
  const c = useColors();
  const { online, availableUntil, allowed, isLoading, setAvailable, isSaving } =
    useChatAvailability();

  if (!allowed) return null;

  // Holds its own height while the first read is in flight. Returning null
  // meant the card dropped in a moment after the list had drawn and shoved
  // every row down the screen — the inbox visibly jumped on every open.
  if (isLoading) {
    return <View className="mx-5 mb-2 h-[62px] rounded-md border border-border bg-card" />;
  }

  const mine = !!availableUntil;
  const subtitle = mine
    ? t('chat.available.until', { time: clockTime(availableUntil) })
    : online
      ? t('chat.available.colleague')
      : t('chat.available.off');

  return (
    <View className="mx-5 mb-2 flex-row items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
      <View
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: online ? c.success ?? '#22c55e' : c.mutedForeground }}
      />
      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{t('chat.available.title')}</Text>
        <Text className="text-sm text-muted-foreground">{subtitle}</Text>
      </View>
      <Switch value={mine} onValueChange={setAvailable} disabled={isSaving} />
    </View>
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
      <View>
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: c.muted }}
        >
          <Text className="text-base font-semibold text-foreground">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        {/* Still on the site. It decides whether answering in the next minute
            reaches them or lands in an inbox, and the desk has shown it in
            its own list from the start. */}
        {person.present ? (
          <View
            className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2"
            style={{ backgroundColor: c.success ?? '#22c55e', borderColor: c.background }}
          />
        ) : null}
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

        {/* Where the question came from, plus what makes this row worth
            grouping: how many conversations, how many quotes are on the
            table. */}
        <View className="mt-0.5 flex-row items-center gap-3">
          {latest?.surface ? (
            <Badge icon="pricetag-outline" label={surfaceLabel(t, latest.surface)} />
          ) : null}
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
