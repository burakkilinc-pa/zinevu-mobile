import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime } from '@/lib/time';
import { uuidv4 } from '@/lib/uuid';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { setActiveConversation } from '@/features/push/use-push';
import {
  useSendMessage,
  useThread,
  useThreadCustomer,
  useTypingSignal,
} from '@/features/chat/hooks/use-chat';
import { useVisitorTyping } from '@/features/chat/realtime-state';
import { markThreadRead } from '@/features/chat/api/chat.api';
import { CustomerHeader } from '@/features/chat/components/customer-header';
import type { ChatMessage } from '@/features/chat/types';

/**
 * One conversation.
 *
 * The dock is hidden here (see the tabs layout) so the composer sits on the
 * safe-area edge, the way every messaging app does it — a keyboard, a text
 * field and a tab bar stacked on top of each other is nobody's idea of a chat.
 */
export default function ChatThreadScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const list = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState('');

  const thread = useThread(String(uuid));
  const customer = useThreadCustomer(String(uuid));
  const send = useSendMessage(String(uuid));
  const typing = useTypingSignal(String(uuid));
  const visitorTyping = useVisitorTyping(String(uuid));

  const canReply = hasPermission(user, PERMISSIONS.chatReply);

  // While this thread is on screen its pushes stay silent — a banner over the
  // conversation you are already reading is pure noise.
  useEffect(() => {
    setActiveConversation(String(uuid));
    return () => setActiveConversation(null);
  }, [uuid]);

  const messages = useMemo(() => thread.data ?? [], [thread.data]);

  // Opening the thread marks it read server-side; a message that lands over
  // the socket while it is already open does not. Without this the badge
  // would sit on a conversation the dealer is looking straight at.
  const lastVisitorMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].authorType === 'visitor') return messages[i].id;
    }
    return null;
  }, [messages]);

  const readUpTo = useRef<string | null>(null);
  useEffect(() => {
    if (!lastVisitorMessage) return;
    const firstLoad = readUpTo.current === null;
    readUpTo.current = lastVisitorMessage;
    // The fetch that opened the thread already claimed everything it carried.
    if (firstLoad) return;
    void markThreadRead(String(uuid)).catch(() => {});
  }, [lastVisitorMessage, uuid]);

  // Follow the conversation down as it grows, the way a chat should — and
  // again when the typing bubble appears, which is also the list getting
  // taller under the reader.
  useEffect(() => {
    if (messages.length === 0 && !visitorTyping) return;
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [messages.length, visitorTyping]);

  function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;

    setDraft('');
    // The message itself says we have stopped writing; leaving the bubble up
    // after it would be a lie told to the customer.
    typing.stop();
    // A fresh id per send: the backend dedupes on it, so a retry of a request
    // that actually landed cannot post the same reply twice.
    send.mutate({ body, clientMessageId: uuidv4() });
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text className="flex-1 pr-3 text-base font-semibold text-foreground" numberOfLines={1}>
          {customer.data?.name || customer.data?.email || t('chat.anonymous')}
        </Text>
      </View>

      {customer.data ? (
        <CustomerHeader customer={customer.data} currentThread={String(uuid)} />
      ) : null}

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        {thread.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => <Bubble message={item} />}
            ListFooterComponent={
              visitorTyping ? (
                <Text className="px-1 pt-1 text-xs text-muted-foreground">
                  {t('chat.typing', {
                    name: customer.data?.name || t('chat.anonymous'),
                  })}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <Text className="py-12 text-center text-sm text-muted-foreground">
                {t('chat.noMessages')}
              </Text>
            }
          />
        )}

        {canReply ? (
          <View
            className="flex-row items-end gap-2 border-t border-border px-3 pt-2"
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }}
          >
            <TextInput
              value={draft}
              onChangeText={(next) => {
                setDraft(next);
                if (next.trim()) typing.onType();
              }}
              onBlur={typing.stop}
              placeholder={t('chat.composerPlaceholder')}
              placeholderTextColor={c.mutedForeground}
              multiline
              className="max-h-28 flex-1 rounded-2xl bg-muted px-4 py-2.5 text-base text-foreground"
            />
            <Pressable
              onPress={submit}
              disabled={!draft.trim() || send.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: c.primary,
                opacity: !draft.trim() || send.isPending ? 0.4 : 1,
              }}
            >
              <Ionicons name="arrow-up" size={20} color={c.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View className="border-t border-border px-5 py-4">
            <Text className="text-center text-xs text-muted-foreground">
              {t('chat.readOnly')}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const c = useColors();
  const mine = message.authorType === 'agent';

  // A system line ("joined", "closed") is not anybody's message — it sits
  // centred and quiet rather than taking a side.
  if (message.authorType === 'system') {
    return (
      <Text className="py-1 text-center text-xs text-muted-foreground">{message.body}</Text>
    );
  }

  return (
    <View className={mine ? 'items-end' : 'items-start'}>
      <View
        className="max-w-[82%] gap-1 rounded-2xl px-3.5 py-2.5"
        style={{
          backgroundColor: mine ? c.primary : c.muted,
          opacity: message.pending ? 0.6 : 1,
        }}
      >
        {message.attachments.map((attachment) =>
          attachment.isImage ? (
            <Image
              key={attachment.id}
              source={{ uri: attachment.thumbUrl ?? attachment.url }}
              contentFit="cover"
              style={{ width: 200, height: 150, borderRadius: 10 }}
            />
          ) : (
            <Text
              key={attachment.id}
              className="text-sm underline"
              style={{ color: mine ? c.primaryForeground : c.foreground }}
            >
              {attachment.fileName}
            </Text>
          )
        )}

        {message.body ? (
          <Text
            className="text-[15px] leading-5"
            style={{ color: mine ? c.primaryForeground : c.foreground }}
          >
            {message.body}
          </Text>
        ) : null}

        <Text
          className="self-end text-[10px]"
          style={{ color: mine ? c.primaryForeground : c.mutedForeground, opacity: 0.7 }}
        >
          {message.pending ? '…' : clockTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}
