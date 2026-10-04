import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey, type TFunction } from '@/lib/i18n';
import { clockTime, dayLabel, relativeTime, sameLocalDay } from '@/lib/time';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';
import { offerKeys } from '@/features/leads/hooks/use-offer';
import {
  useConversation,
  useMarkConversationRead,
  useSendWhatsapp,
} from '@/features/inbox/hooks/use-inbox';
import type { ConversationEntry, ConversationView } from '@/features/inbox/types';

/**
 * One customer's conversation, on a phone.
 *
 * It sits on the ROOT stack rather than inside the leads tab, because it is
 * opened from three places — the Messages list, the lead itself, and a
 * notification — and a screen pushed into the leads stack from the Messages tab
 * sent Back to the leads list: a place the reader had never been. A pushed root
 * screen covers the dock and returns to exactly where it was opened from.
 *
 * What this screen exists to make possible is the thing the notification
 * promises: read what the assistant and the customer have said to each other,
 * and take it over by simply writing. There is no "take over" button and
 * there deliberately is not one — the agent's rule is already that a message
 * with a user id on it silences the machine for good, so typing IS the
 * handover. A second control would be a second way to do one thing, and the
 * two could disagree.
 */
export default function LeadConversationScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const list = useRef<ComponentRef<typeof KeyboardChatScrollView>>(null);
  const [draft, setDraft] = useState('');

  const query = useConversation(ref ?? '');
  const send = useSendWhatsapp(ref ?? '');
  const markRead = useMarkConversationRead();

  // Who this thread is with. The conversation endpoint answers about messages
  // only, so the request itself is read separately — on the SAME query key the
  // lead screen uses, which makes it free when you arrived from there and one
  // small request when you arrived from the inbox or a notification.
  const lead = useQuery({
    queryKey: offerKeys.detail(String(ref)),
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
    staleTime: 60_000,
  }).data;

  const view = query.data;
  const mayReply = hasPermission(user, PERMISSIONS.leadsCommunicate);

  // Reading it IS reading it. Once, when something unread is actually on
  // screen — not on every poll, which would write a row every ten seconds.
  const cleared = useRef(false);
  useEffect(() => {
    if (!ref || cleared.current || !view || view.unread === 0) return;
    cleared.current = true;
    markRead.mutate(ref);
  }, [ref, view, markRead]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body || send.isPending) return;

    try {
      await send.mutateAsync(body);
      setDraft('');
    } catch (e) {
      // The server refuses for reasons the dealer can act on — a shut window,
      // a paused number — so its own sentence beats a generic failure.
      toast.error(e instanceof Error && e.message ? e.message : t('conversation.sendFailed'));
    }
  };

  const entries = view?.entries ?? [];
  // Free text only reaches a customer inside Meta's 24 hours. Saying why the
  // box is closed is the whole difference between a dealer ringing them and a
  // dealer assuming the app is broken.
  const canWrite = mayReply && !!view?.whatsapp.connected && !!view?.whatsapp.windowOpen;

  // The header answers "whose thread is this, against which quote, how far
  // along". Without it the screen said "Conversation" and nothing else — you
  // could read five messages without learning who wrote them.
  const title = lead?.customerName || lead?.offerNo || t('conversation.title');
  const moment = lead?.offerSignedAt ?? lead?.offerSentAt ?? lead?.createdAt ?? null;
  const subtitle = [
    lead?.offerNo,
    lead?.status ? t(`leads.status.${lead.status}` as MessageKey) : null,
    moment ? relativeTime(moment) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader
        title={title}
        subtitle={subtitle || undefined}
        right={
          ref ? (
            <Pressable
              onPress={() => router.push(`/leads/${ref}`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('conversation.openLead')}
              className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
            >
              <Ionicons name="albums-outline" size={21} color={c.foreground} />
            </Pressable>
          ) : null
        }
      />

      {view ? <AgentBanner view={view} /> : null}

      <KeyboardChatScrollView
        ref={list}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {query.isLoading ? (
          <View className="py-16">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : entries.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-base text-muted-foreground">{t('conversation.empty')}</Text>
          </View>
        ) : (
          entries.map((entry, i) => (
            <View key={`${entry.kind}-${entry.id}`} className="gap-2.5">
              {/* A thread that ran over three days showed nothing but clock
                  times, so every line looked like it happened this morning. */}
              {sameLocalDay(entries[i - 1]?.occurredAt, entry.occurredAt) ? null : (
                <DaySeparator iso={entry.occurredAt} />
              )}
              <Bubble entry={entry} />
            </View>
          ))
        )}
      </KeyboardChatScrollView>

      {/* The offset exists to CANCEL the bar's own bottom inset while the
          keyboard is up, and the inset has to be there for it to cancel. It
          was not: the bar carried a flat `py-2`, so the offset had nothing to
          take back and simply pushed the composer that far behind the
          keyboard — the send button came out sliced in half. The live-chat
          thread has had the pair right from the start; this is the same two
          lines. */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          className="border-t border-border bg-card px-4 pt-2"
          style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }}
        >
          {canWrite ? (
            <View className="flex-row items-end gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('conversation.placeholder')}
                placeholderTextColor={c.mutedForeground}
                multiline
                className="max-h-28 flex-1 rounded-2xl px-4 py-2.5 text-base text-foreground"
                style={{ backgroundColor: c.muted }}
              />
              <Pressable
                onPress={() => void onSend()}
                disabled={!draft.trim() || send.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('conversation.send')}
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: draft.trim() ? c.foreground : c.muted }}
              >
                {send.isPending ? (
                  <ActivityIndicator color={c.background} size="small" />
                ) : (
                  <Ionicons
                    name="send"
                    size={18}
                    color={draft.trim() ? c.background : c.mutedForeground}
                  />
                )}
              </Pressable>
            </View>
          ) : (
            <View className="gap-2 py-2">
              <Text className="text-center text-sm text-muted-foreground">
                {!mayReply
                  ? t('chat.readOnly')
                  : !view?.whatsapp.connected
                    ? t('conversation.noChannel')
                    : t('conversation.window.closed')}
              </Text>
              {/* The one place wa.me is the right answer: nothing we can send
                  from here reaches them, and the dealer's own phone can. */}
              {mayReply && view?.whatsapp.to ? (
                <Pressable
                  onPress={() => void Linking.openURL(`https://wa.me/${view.whatsapp.to}`)}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-2 rounded-full py-2.5"
                  style={{ backgroundColor: c.muted }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={c.foreground} />
                  <Text className="text-sm font-medium text-foreground">
                    {t('conversation.openOwnWhatsapp')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardStickyView>
    </Screen>
  );
}

/** "Today" / "Yesterday" / "12 June 2026", between two days of messages. */
function DaySeparator({ iso }: { iso: string | null }) {
  const c = useColors();
  const label = dayLabel(iso);

  if (!label) return null;

  return (
    <View className="items-center py-1">
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: c.muted }}>
        <Text className="text-[11px] font-medium text-muted-foreground">{label}</Text>
      </View>
    </View>
  );
}

/**
 * Who is answering this, in one line above the thread.
 *
 * Only two states are worth a banner. "The assistant is on it" tells somebody
 * they can put the phone down — and says in the same breath that writing
 * stops it, because that is the one consequence a dealer must not discover by
 * accident. "It handed over" is the opposite: this is yours now. A
 * conversation with no agent behind it says nothing at all, which is the
 * right amount.
 */
function AgentBanner({ view }: { view: ConversationView }) {
  const t = useT();
  const c = useColors();

  const handedOver = view.agent.status === 'handed_over';

  // Outranks both of the others, and is the only one of the three that is
  // about the CUSTOMER rather than about us. Somebody who asked to be left
  // alone has said the most important thing on this screen.
  if (view.whatsapp.optedOut) {
    return (
      <View
        className="mx-4 mb-2 flex-row items-center gap-2 rounded-md px-3 py-2"
        style={{ backgroundColor: c.muted }}
      >
        <Ionicons name="hand-left-outline" size={14} color={c.destructive} />
        <Text className="flex-1 text-xs" style={{ color: c.destructive }}>
          {t('conversation.optedOut')}
        </Text>
      </View>
    );
  }

  if (!view.agent.holds && !handedOver) {
    return view.whatsapp.windowOpen && view.whatsapp.windowExpiresAt ? (
      <Text className="px-5 pb-1 text-xs text-muted-foreground">
        {t('conversation.window.expires', { time: clockTime(view.whatsapp.windowExpiresAt) })}
      </Text>
    ) : null;
  }

  return (
    <View
      className="mx-4 mb-2 flex-row items-center gap-2 rounded-md px-3 py-2"
      style={{ backgroundColor: c.muted }}
    >
      <Text className="text-sm">{view.agent.holds ? '🤖' : '🙋'}</Text>
      <Text className="flex-1 text-xs text-muted-foreground">
        {view.agent.holds ? t('conversation.agent.holds') : t('conversation.agent.handedOver')}
      </Text>
    </View>
  );
}

/**
 * What a bubble is allowed to say when the body is empty.
 *
 * A mail we sent from a template often stores no plain-text body at all, so
 * `bodyText` is null and the bubble used to render a bare em-dash — five
 * blank boxes where five quotes had gone out. Everything the message DID
 * carry is here: the server's excerpt, the subject, the template it was sent
 * from, and the files that rode along. One of those is always something.
 */
function bodyOf(entry: ConversationEntry): string {
  return (entry.bodyText ?? '').trim() || (entry.preview ?? '').trim();
}

function headingOf(entry: ConversationEntry): string | null {
  const subject = (entry.subject ?? '').trim();
  if (subject) return subject;
  const template = (entry.templateName ?? '').trim();

  return template || null;
}

/**
 * One line of the conversation.
 *
 * The customer's words sit left, everything of ours sits right — and "ours"
 * is three different authors, so the machine's messages carry a label. A
 * dealer reading a thread a machine had on their behalf needs to know which
 * sentences they are being held to, and `created_by` alone could never tell
 * them: it is null for the assistant AND for every automated send.
 */
function Bubble({ entry }: { entry: ConversationEntry }) {
  const t = useT();
  const c = useColors();

  const mine = entry.direction !== 'in';
  const internal = entry.direction === 'internal' || entry.channel === 'note';
  const body = bodyOf(entry);
  const heading = headingOf(entry);

  if (internal) {
    return (
      <View className="items-center">
        <View className="max-w-[90%] rounded-md px-3 py-2" style={{ backgroundColor: c.muted }}>
          <Text className="text-center text-xs text-muted-foreground">
            {body || heading || t('conversation.note')}
          </Text>
        </View>
      </View>
    );
  }

  const label =
    entry.authorKind === 'agent'
      ? t('conversation.author.agent')
      : entry.authorKind === 'system'
        ? t('conversation.author.system')
        : entry.authorName;

  const fg = mine ? c.background : c.foreground;
  // Nothing at all to print and no files either: only then is a dash honest.
  const emptyHanded = !body && !heading && entry.attachments.length === 0;

  return (
    <View className={mine ? 'items-end' : 'items-start'}>
      <View
        className="max-w-[85%] rounded-2xl px-3.5 py-2"
        style={{ backgroundColor: mine ? c.foreground : c.muted }}
      >
        {mine && label ? (
          <Text className="pb-0.5 text-[11px] font-medium" style={{ color: fg, opacity: 0.7 }}>
            {label}
          </Text>
        ) : null}

        {/* A mail's subject IS its headline, and for a templated send it is
            usually the only sentence stored. Printed above the body rather
            than instead of it, so a mail with both reads as a mail. */}
        {heading ? (
          <Text className="pb-0.5 text-sm font-semibold" style={{ color: fg }}>
            {heading}
          </Text>
        ) : null}

        {body ? (
          <Text className="text-base" style={{ color: fg }}>
            {body}
          </Text>
        ) : emptyHanded ? (
          <Text className="text-base" style={{ color: fg, opacity: 0.6 }}>
            —
          </Text>
        ) : null}

        {entry.attachments.map((file, i) => (
          <View key={`${file.name}-${i}`} className="flex-row items-center gap-1.5 pt-1">
            <Ionicons name="document-attach-outline" size={13} color={fg} />
            <Text className="flex-1 text-xs" style={{ color: fg, opacity: 0.85 }} numberOfLines={1}>
              {file.name}
            </Text>
          </View>
        ))}

        <View className="flex-row items-center justify-end gap-1 pt-0.5">
          {/* The receipt that matters on a quote: they opened it. */}
          {mine && entry.openedAt ? (
            <Text className="text-[10px]" style={{ color: fg, opacity: 0.7 }}>
              {openedLabel(t, entry.openedAt)}
            </Text>
          ) : null}
          <Text
            className="text-[10px]"
            style={{ color: mine ? c.background : c.mutedForeground, opacity: 0.7 }}
          >
            {clockTime(entry.occurredAt)}
          </Text>
          {mine && entry.readReceiptAt ? (
            <Ionicons name="checkmark-done" size={12} color={c.background} />
          ) : mine && entry.deliveredAt ? (
            <Ionicons name="checkmark" size={12} color={c.background} />
          ) : null}
        </View>
      </View>
      {entry.failure ? (
        <Text className="pt-0.5 text-[11px]" style={{ color: c.destructive }}>
          {entry.failure}
        </Text>
      ) : null}
    </View>
  );
}

/** "Opened · 14:02" — same day, else the day it was opened. */
function openedLabel(t: TFunction, iso: string): string {
  const sameDay = sameLocalDay(iso, new Date().toISOString());

  return `${t('conversation.opened')} ${sameDay ? clockTime(iso) : dayLabel(iso)} ·`;
}
