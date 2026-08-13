import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { formatDateTime } from '@/lib/time';
import { useReplyToTicket, useTicket } from '@/features/support/hooks/use-support';
import type { TicketMessage } from '@/features/support/api/support.api';

/** One support thread, and the reply box under it. */
export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');

  const ticketId = Number(id);
  const query = useTicket(ticketId);
  const reply = useReplyToTicket(ticketId);

  const ticket = query.data?.ticket;
  const messages = query.data?.messages ?? [];
  // A closed ticket takes no more replies — the backend refuses them, so the
  // composer must not pretend otherwise.
  const canReply = ticket ? ticket.status !== 'closed' : false;

  function submit() {
    const body = draft.trim();
    if (!body || reply.isPending) return;

    setDraft('');
    reply.mutate(body, {
      onError: () => setDraft(body),
    });
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
        <View className="flex-1 pr-3">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {ticket?.subject ?? t('tabs.support')}
          </Text>
          {ticket?.referenceNo ? (
            <Text className="text-xs text-muted-foreground">{ticket.referenceNo}</Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        {query.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={c.mutedForeground} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </ScrollView>
        )}

        {canReply ? (
          <View
            className="flex-row items-end gap-2 border-t border-border px-3 pt-2"
            style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('support.replyPlaceholder')}
              placeholderTextColor={c.mutedForeground}
              multiline
              className="max-h-28 flex-1 rounded-2xl bg-muted px-4 py-2.5 text-base text-foreground"
            />
            <Pressable
              onPress={submit}
              disabled={!draft.trim() || reply.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('chat.send')}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: c.primary,
                opacity: !draft.trim() || reply.isPending ? 0.4 : 1,
              }}
            >
              <Ionicons name="arrow-up" size={20} color={c.background} />
            </Pressable>
          </View>
        ) : (
          <View className="border-t border-border px-5 py-4">
            <Text className="text-center text-xs text-muted-foreground">
              {t('support.closedNotice')}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Message({ message }: { message: TicketMessage }) {
  const t = useT();
  const c = useColors();
  const fromZinevu = message.authorType === 'admin';

  return (
    <View
      className="gap-1.5 rounded-2xl p-3.5"
      style={{ backgroundColor: fromZinevu ? c.muted : c.card, borderWidth: fromZinevu ? 0 : 1, borderColor: c.border }}
    >
      <View className="flex-row items-center gap-2">
        <Ionicons
          name={fromZinevu ? 'shield-checkmark' : 'person-circle-outline'}
          size={14}
          color={c.mutedForeground}
        />
        <Text className="flex-1 text-xs font-medium text-muted-foreground" numberOfLines={1}>
          {fromZinevu ? t('support.fromZinevu') : message.authorName || t('support.fromYou')}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatDateTime(message.createdAt)}
        </Text>
      </View>

      {message.body ? (
        <Text className="text-[15px] leading-5 text-foreground">{message.body}</Text>
      ) : null}

      {message.attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => WebBrowser.openBrowserAsync(attachment.url)}
          accessibilityRole="link"
          className="flex-row items-center gap-1.5 pt-1"
        >
          <Ionicons name="attach-outline" size={14} color={c.foreground} />
          <Text className="flex-1 text-sm text-foreground underline" numberOfLines={1}>
            {attachment.fileName ?? t('support.attachment')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
