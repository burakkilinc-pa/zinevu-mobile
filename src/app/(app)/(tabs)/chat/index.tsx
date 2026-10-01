import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Switch, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useInbox, useUnlinked } from '@/features/inbox/hooks/use-inbox';
import type { InboxRow, UnlinkedRow } from '@/features/inbox/types';
import { CARD_CLASS, CARD_SHADOW } from '@/components/ui/card';

/**
 * Two sources of message, one tab.
 *
 * A dealer looking for "a message" does not care which pipe carried it, and
 * the dock has no room for a fifth icon — the brand Z only reads as the hero
 * dead centre. So the live chat and the customers' own conversations share
 * this screen behind a two-chip switch.
 *
 * They are not the same thing underneath and the screen does not pretend they
 * are. Website is an anonymous visitor standing on a page who will leave in a
 * minute, which is why availability, presence dots and a websocket live on
 * that side only. WhatsApp & mail is a named customer on a thread that keeps,
 * against a request with a reference number.
 */
type Source = 'website' | 'leads';

export default function MessagesScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  // The unlinked-WhatsApp push has no id to route on, so it names the segment
  // instead. See PushData in use-push.ts.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [source, setSource] = useState<Source>(tab === 'whatsapp' ? 'leads' : 'website');

  const mayChat = hasPermission(user, PERMISSIONS.chatView);
  const mayLeads = hasPermission(user, PERMISSIONS.leadsView);

  // A member with exactly one of the two permissions gets that one list with
  // no switch above it — a chip that is the only choice is furniture.
  const both = mayChat && mayLeads;
  const shown: Source = both ? source : mayChat ? 'website' : 'leads';

  if (!mayChat && !mayLeads) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('chat.noAccess.title')}
        subtitle={t('chat.noAccess.body')}
      />
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <View className="px-5 pb-2 pt-1">
        <Text className="text-2xl font-bold text-foreground">{t('tabs.messages')}</Text>
      </View>

      {both ? <SourceSwitch value={shown} onChange={setSource} /> : null}

      {shown === 'website' ? <WebsiteList /> : <LeadList />}
    </Screen>
  );
}

function SourceSwitch({ value, onChange }: { value: Source; onChange: (s: Source) => void }) {
  const t = useT();
  const c = useColors();
  // The SAME query key LeadList uses, deliberately: react-query dedupes it to
  // one request, so the badge costs nothing. A second filter ('unanswered')
  // would read more naturally and double the polling.
  const rows = useInbox('all').data ?? [];
  const unlinked = useUnlinked().data ?? [];
  const waiting =
    rows.filter((row) => row.awaitingReply && !row.agentHolds).length + unlinked.length;

  const chips: { key: Source; label: string; count: number }[] = [
    { key: 'website', label: t('inbox.source.website'), count: 0 },
    { key: 'leads', label: t('inbox.source.leads'), count: waiting },
  ];

  return (
    <View className="mb-2 flex-row gap-2 px-5">
      {chips.map((chip) => {
        const active = chip.key === value;

        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            accessibilityRole="button"
            accessibilityState={active ? { selected: true } : {}}
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: active ? c.foreground : c.muted }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: active ? c.background : c.foreground }}
            >
              {chip.label}
            </Text>
            {chip.count > 0 ? (
              <View
                className="min-w-5 items-center rounded-full px-1.5"
                style={{ backgroundColor: active ? c.background : c.destructive }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: active ? c.foreground : '#fff' }}
                >
                  {chip.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The live chat — one row per PERSON, not per thread.
 *
 * Somebody who asked twice from two devices is one person with two
 * conversations; three rows for them is three chances to reply without
 * knowing what was already said. The row shows how many threads and how many
 * offers they have, so the dealer opens a conversation already knowing who
 * they are talking to.
 */
function WebsiteList() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();

  /**
   * One list. No slices.
   *
   * "Waiting" and "Open" split the inbox on who happened to write last, which
   * is not a thing anybody reading their inbox is thinking about — and it
   * moved rows out from under them: a colleague takes a thread over, the last
   * line is no longer the visitor's, and the conversation the phone had just
   * buzzed about was gone from the tab they were looking at.
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

  const customers = query.data ?? [];

  return (
    <>
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
    </>
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
    return <View className="mx-5 mb-2.5 h-[62px] rounded-2xl border border-border bg-card" />;
  }

  const mine = !!availableUntil;
  const subtitle = mine
    ? t('chat.available.until', { time: clockTime(availableUntil) })
    : online
      ? t('chat.available.colleague')
      : t('chat.available.off');

  return (
    <View className="mx-5 mb-2.5 flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
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
      // A card, like every other list in the app. It was the last ruled list —
      // hairline-separated rows on the bare paper — which is what made Messages
      // look like a screen from a different product once the ground had dots on
      // it and everything else had lifted onto a white face.
      className={`${CARD_CLASS} mx-5 mb-2.5 flex-row items-center gap-3 px-4 py-3.5 active:opacity-90`}
      style={CARD_SHADOW}
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

/**
 * The customers' own conversations — WhatsApp on the dealer's business
 * number, and replies to the mails we sent.
 *
 * One list, newest first, and the rows carry the one thing that decides
 * whether anybody has to open them: whether the assistant is already
 * answering. Without it every row reads as work still owed, including the
 * conversations a machine is handling correctly — which is the fastest way
 * for a list to stop being read.
 *
 * The unlinked pile sits on top rather than at the bottom. A number nobody
 * has matched to a request is a customer writing for the FIRST time, which
 * is the most valuable message on a business number and the easiest to lose.
 */
function LeadList() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();

  const query = useInbox('all');
  const unlinked = useUnlinked();

  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      await Promise.all([query.refetch(), unlinked.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const rows = query.data ?? [];
  const strangers = unlinked.data ?? [];

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => row.ref}
      contentContainerStyle={{ paddingBottom: bottom }}
      ListHeaderComponent={
        strangers.length > 0 ? (
          <View className="mb-1">
            <Text className="px-5 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">
              {t('inbox.unlinked.title')}
            </Text>
            {strangers.map((row) => (
              <UnlinkedRowView key={row.messageId} row={row} />
            ))}
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <LeadRow row={item} onPress={() => router.push(`/conversation/${item.ref}`)} />
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
        ) : strangers.length > 0 ? null : (
          <View className="items-center gap-2 px-10 py-16">
            <Ionicons name="mail-outline" size={26} color={c.mutedForeground} />
            <Text className="text-base text-muted-foreground">
              {query.isError ? t('common.error') : t('inbox.empty')}
            </Text>
            {query.isError ? null : (
              <Text className="text-center text-sm text-muted-foreground">
                {t('inbox.emptyHint')}
              </Text>
            )}
          </View>
        )
      }
    />
  );
}

function LeadRow({ row, onPress }: { row: InboxRow; onPress: () => void }) {
  const t = useT();
  const c = useColors();

  const name = row.customerName || row.offerNo || t('inbox.anonymous');
  const channelIcon: keyof typeof Ionicons.glyphMap =
    row.lastChannel === 'whatsapp'
      ? 'logo-whatsapp'
      : row.lastChannel === 'call'
        ? 'call-outline'
        : row.lastChannel === 'note'
          ? 'document-text-outline'
          : 'mail-outline';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // A card, like every other list in the app. It was the last ruled list —
      // hairline-separated rows on the bare paper — which is what made Messages
      // look like a screen from a different product once the ground had dots on
      // it and everything else had lifted onto a white face.
      className={`${CARD_CLASS} mx-5 mb-2.5 flex-row items-center gap-3 px-4 py-3.5 active:opacity-90`}
      style={CARD_SHADOW}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: c.muted }}
      >
        <Ionicons name={channelIcon} size={19} color={c.mutedForeground} />
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {name}
          </Text>
          <Text className="text-xs text-muted-foreground">{relativeTime(row.lastAt)}</Text>
        </View>

        <Text
          className="text-sm text-muted-foreground"
          numberOfLines={1}
          style={row.awaitingReply && !row.agentHolds ? { color: c.foreground } : undefined}
        >
          {row.lastPreview || row.lastSubject || t('chat.noMessages')}
        </Text>

        {row.agentHolds ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Text className="text-xs">🤖</Text>
            <Text className="text-xs text-muted-foreground">{t('inbox.agentHolds')}</Text>
          </View>
        ) : row.awaitingReply ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Ionicons name="alert-circle-outline" size={11} color={c.destructive} />
            <Text className="text-xs" style={{ color: c.destructive }}>
              {t('inbox.awaitingReply')}
            </Text>
          </View>
        ) : null}
      </View>

      {row.unread > 0 ? (
        <View
          className="min-w-6 items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: c.destructive }}
        >
          <Text className="text-xs font-bold text-white">{row.unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * A number on no lead yet.
 *
 * Not pressable, deliberately. Linking a thread to a request — or making a
 * request out of it — spends a lead from the dealer's plan and needs a lead
 * to pick, and neither is a decision to make by accident on a list row. The
 * phone's job here is to say somebody wrote; the portal's is to file them.
 */
function UnlinkedRowView({ row }: { row: UnlinkedRow }) {
  const t = useT();
  const c = useColors();

  return (
    // The same card as every other row in this list. It stayed a ruled row when
    // the rest became cards, which is what made the e-mail side look like it
    // was built to a different design from the website side.
    <View
      className={`${CARD_CLASS} mx-5 mb-2.5 flex-row items-center gap-3 px-4 py-3`}
      style={CARD_SHADOW}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: c.muted }}
      >
        <Ionicons name="logo-whatsapp" size={17} color={c.mutedForeground} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {row.fromName || t('inbox.anonymous')}
          </Text>
          <Text className="text-xs text-muted-foreground">{relativeTime(row.lastAt)}</Text>
        </View>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {row.preview || t('chat.noMessages')}
        </Text>
        <Text className="text-xs text-muted-foreground">{t('inbox.unlinked.hint')}</Text>
      </View>
    </View>
  );
}
