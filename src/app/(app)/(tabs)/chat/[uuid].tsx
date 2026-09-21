import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
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
import { capturePhotos, PermissionDeniedError, type CapturedFile } from '@/lib/media';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { setActiveConversation } from '@/features/push/use-push';
import {
  useQuickReplies,
  useSendMessage,
  useThread,
  useThreadCustomer,
  useTypingSignal,
} from '@/features/chat/hooks/use-chat';
import { useVisitorTyping } from '@/features/chat/realtime-state';
import { markThreadRead } from '@/features/chat/api/chat.api';
import { ConversationHeader } from '@/features/chat/components/customer-header';
import { QuickReplySheet } from '@/features/chat/components/quick-reply-sheet';
import type { ChatMessage } from '@/features/chat/types';

/** Photos per message. The backend takes six; four fits a phone composer. */
const MAX_FILES = 4;

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
  const [files, setFiles] = useState<CapturedFile[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  // Which canned answer the draft came from, reported on send so the picker
  // can order itself by what the team really uses.
  const quickReplyId = useRef<number | null>(null);

  const thread = useThread(String(uuid));
  const customer = useThreadCustomer(String(uuid));
  const send = useSendMessage(String(uuid));
  const typing = useTypingSignal(String(uuid));
  const visitorTyping = useVisitorTyping(String(uuid));

  const canReply = hasPermission(user, PERMISSIONS.chatReply);
  const detail = thread.data?.detail ?? null;
  const quickReplies = useQuickReplies(detail?.locale ?? null);

  // While this thread is on screen its pushes stay silent — a banner over the
  // conversation you are already reading is pure noise.
  useEffect(() => {
    setActiveConversation(String(uuid));
    return () => setActiveConversation(null);
  }, [uuid]);

  const messages = useMemo(() => thread.data?.messages ?? [], [thread.data]);

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

  /**
   * Back, even when there is nowhere to go back to.
   *
   * A push tap (or a notification that opened the app cold) lands straight on
   * this screen with an empty history, and `router.back()` on an empty stack
   * does nothing at all — which is exactly what it looked like: a back button
   * that does not work. Falling through to the inbox is where Back means to
   * go anyway.
   */
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/chat');
  }

  function addPhotos() {
    Alert.alert(t('chat.attach.title'), undefined, [
      { text: t('common.camera'), onPress: () => void pickPhotos('camera') },
      { text: t('common.gallery'), onPress: () => void pickPhotos('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  async function pickPhotos(source: 'camera' | 'library') {
    try {
      const picked = await capturePhotos(source, MAX_FILES);
      if (picked.length === 0) return;
      setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
    } catch (err) {
      toast.error(
        err instanceof PermissionDeniedError ? err.message : t('chat.attach.failed')
      );
    }
  }

  function submit() {
    const body = draft.trim();
    if ((!body && files.length === 0) || send.isPending) return;

    const attachments = files;
    setDraft('');
    setFiles([]);
    // The message itself says we have stopped writing; leaving the bubble up
    // after it would be a lie told to the customer.
    typing.stop();
    // A fresh id per send: the backend dedupes on it, so a retry of a request
    // that actually landed cannot post the same reply twice.
    send.mutate(
      {
        body,
        clientMessageId: uuidv4(),
        files: attachments,
        quickReplyId: quickReplyId.current,
      },
      {
        onError: () => {
          // Give the typing back rather than swallowing it — a failed send
          // with an empty field is a message the dealer has to remember.
          setDraft((current) => (current.trim() ? current : body));
          setFiles(attachments);
          toast.error(t('chat.sendFailed'));
        },
      }
    );
    quickReplyId.current = null;
  }

  const canSend = (draft.trim().length > 0 || files.length > 0) && !send.isPending;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ConversationHeader
        detail={detail}
        customer={customer.data ?? null}
        customerLoading={customer.isLoading}
        currentThread={String(uuid)}
        open={detailsOpen}
        onToggle={() => setDetailsOpen((value) => !value)}
        onBack={goBack}
      />

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
            // A drag downward puts the keyboard away, and a tap on a bubble
            // does not have to be spent closing it first — what every
            // messenger does, and what the old screen did neither of.
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <Bubble message={item} t={t} />}
            ListFooterComponent={
              visitorTyping ? (
                <Text className="px-1 pt-1 text-xs text-muted-foreground">
                  {t('chat.typing', {
                    name: detail?.name || t('chat.anonymous'),
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
          <View className="border-t border-border" style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }}>
            {files.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 10 }}
              >
                {files.map((file, index) => (
                  <View key={file.uri}>
                    <Image
                      source={{ uri: file.uri }}
                      contentFit="cover"
                      style={{ width: 64, height: 64, borderRadius: 10 }}
                    />
                    <Pressable
                      onPress={() =>
                        setFiles((prev) => prev.filter((_, i) => i !== index))
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat.attach.remove')}
                      className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: c.foreground }}
                    >
                      <Ionicons name="close" size={12} color={c.background} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View className="flex-row items-end gap-1.5 px-3 pt-2">
              <Pressable
                onPress={addPhotos}
                disabled={files.length >= MAX_FILES}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('chat.attach.title')}
                className="h-11 w-9 items-center justify-center"
                style={{ opacity: files.length >= MAX_FILES ? 0.4 : 1 }}
              >
                <Ionicons name="image-outline" size={22} color={c.mutedForeground} />
              </Pressable>

              {(quickReplies.data?.length ?? 0) > 0 ? (
                <Pressable
                  onPress={() => setQuickOpen(true)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.quickReplies.title')}
                  className="h-11 w-9 items-center justify-center"
                >
                  <Ionicons name="flash-outline" size={21} color={c.mutedForeground} />
                </Pressable>
              ) : null}

              <TextInput
                value={draft}
                onChangeText={(next) => {
                  setDraft(next);
                  if (next.trim()) typing.onType();
                }}
                onBlur={typing.stop}
                // The keyboard halves the list, and the last line — the one
                // being answered — is exactly what slides out of sight under
                // it. Re-pin once the keyboard has finished coming up.
                onFocus={() => {
                  setTimeout(() => list.current?.scrollToEnd({ animated: true }), 250);
                }}
                placeholder={t('chat.composerPlaceholder')}
                placeholderTextColor={c.mutedForeground}
                multiline
                className="max-h-28 flex-1 rounded-2xl bg-muted px-4 py-2.5 text-base text-foreground"
              />

              <Pressable
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t('chat.send')}
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: c.primary, opacity: canSend ? 1 : 0.4 }}
              >
                {send.isPending ? (
                  <ActivityIndicator size="small" color={c.primaryForeground} />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={c.primaryForeground} />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="border-t border-border px-5 py-4">
            <Text className="text-center text-xs text-muted-foreground">
              {t('chat.readOnly')}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <QuickReplySheet
        visible={quickOpen}
        replies={quickReplies.data ?? []}
        onClose={() => setQuickOpen(false)}
        onPick={(reply) => {
          quickReplyId.current = reply.id;
          setQuickOpen(false);
          // Pasted, not sent: the answer almost always wants a name or a date
          // in front of it, and a canned line sent by accident reads as a bot.
          setDraft((prev) => (prev.trim() ? `${prev.trimEnd()} ${reply.body}` : reply.body));
        }}
      />
    </View>
  );
}

function Bubble({ message, t }: { message: ChatMessage; t: ReturnType<typeof useT> }) {
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

        {/* Time, and on our own lines the receipt: one tick stored, two green
            ticks read. The colour is the whole point — two grey ticks beside
            one grey tick is a difference nobody sees at this size, and "have
            they seen it" is the only question anyone asks of a message they
            already sent. */}
        <View className="flex-row items-center justify-end gap-1">
          <Text
            className="text-[10px]"
            style={{
              color: mine ? c.primaryForeground : c.mutedForeground,
              opacity: 0.7,
            }}
          >
            {message.pending ? '…' : clockTime(message.createdAt)}
          </Text>

          {mine && !message.pending ? (
            <Ionicons
              name={message.readAt ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={message.readAt ? (c.success ?? '#22c55e') : c.primaryForeground}
              style={{ opacity: message.readAt ? 1 : 0.7 }}
              accessibilityLabel={message.readAt ? t('chat.receipt.read') : t('chat.receipt.sent')}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
