import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from 'react-native';
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime } from '@/lib/time';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  useConversation,
  useMarkConversationRead,
  useSendWhatsapp,
} from '@/features/inbox/hooks/use-inbox';
import type { ConversationEntry, ConversationView } from '@/features/inbox/types';

/**
 * One customer's conversation, on a phone.
 *
 * The dock is hidden here (see the tabs layout) so the composer sits on the
 * safe-area edge — a keyboard, a text field and a tab bar stacked on top of
 * each other is nobody's idea of a chat.
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
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const list = useRef<ComponentRef<typeof KeyboardChatScrollView>>(null);
  const [draft, setDraft] = useState('');

  const query = useConversation(ref ?? '');
  const send = useSendWhatsapp(ref ?? '');
  const markRead = useMarkConversationRead();

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

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('conversation.title')} />

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
          entries.map((entry) => <Bubble key={`${entry.kind}-${entry.id}`} entry={entry} />)
        )}
      </KeyboardChatScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View className="border-t border-border bg-background px-4 py-2">
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

  if (internal) {
    return (
      <View className="items-center">
        <View className="max-w-[90%] rounded-md px-3 py-2" style={{ backgroundColor: c.muted }}>
          <Text className="text-center text-xs text-muted-foreground">
            {entry.bodyText || t('conversation.note')}
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

  return (
    <View className={mine ? 'items-end' : 'items-start'}>
      <View
        className="max-w-[85%] rounded-2xl px-3.5 py-2"
        style={{ backgroundColor: mine ? c.foreground : c.muted }}
      >
        {mine && label ? (
          <Text
            className="pb-0.5 text-[11px] font-medium"
            style={{ color: c.background, opacity: 0.7 }}
          >
            {label}
          </Text>
        ) : null}
        <Text className="text-base" style={{ color: mine ? c.background : c.foreground }}>
          {entry.bodyText || '—'}
        </Text>
        <View className="flex-row items-center justify-end gap-1 pt-0.5">
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
