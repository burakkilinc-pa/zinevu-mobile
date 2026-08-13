import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { formatMoneyShort } from '@/lib/money';
import { relativeTime } from '@/lib/time';
import type { ChatCustomer } from '@/features/chat/types';

/**
 * Who you are talking to, above the conversation.
 *
 * The one question a dealer has mid-chat is "which quote do they mean" — a
 * person may have three. So their offers sit here as chips, tappable straight
 * into the lead, and their OTHER conversations sit beside them: the customer
 * does not know they opened a second chat, and answering in the wrong one is
 * how a thread ends up with two half-conversations in it.
 *
 * Collapsed by default. It is context, not the content — the messages are.
 */
export function CustomerHeader({
  customer,
  currentThread,
}: {
  customer: ChatCustomer;
  currentThread: string;
}) {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const others = customer.conversations.filter((conv) => conv.uuid !== currentThread);
  const hasDetail = customer.offers.length > 0 || others.length > 0;
  const phone = customer.phone?.replace(/[^\d+]/g, '') || null;

  return (
    <View className="border-b border-border bg-card">
      <View className="flex-row items-center gap-2 px-4 py-2.5">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {customer.name || customer.email || customer.phone || t('chat.anonymous')}
          </Text>
          {customer.email || customer.phone ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {[customer.email, customer.phone].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>

        {phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone}`)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('leads.detail.call')}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-muted"
          >
            <Ionicons name="call-outline" size={17} color={c.foreground} />
          </Pressable>
        ) : null}

        {hasDetail ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('chat.header.toggle')}
            className="h-8 w-8 items-center justify-center rounded-full active:bg-muted"
          >
            <Ionicons
              name={open ? 'chevron-up' : 'chevron-down'}
              size={17}
              color={c.foreground}
            />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View className="gap-3 px-4 pb-3">
          {customer.offers.length > 0 ? (
            <View className="gap-1.5">
              <Text className="text-xs font-medium uppercase text-muted-foreground">
                {t('chat.header.offers')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {customer.offers.map((offer) => (
                    <Pressable
                      key={offer.ref}
                      onPress={() => router.push(`/leads/${offer.ref}`)}
                      accessibilityRole="button"
                      className="gap-0.5 rounded-xl border border-border px-3 py-2 active:bg-muted"
                    >
                      <Text className="text-xs font-semibold text-foreground">
                        {offer.offerNo || t('chat.header.draftOffer')}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {/* Null total means this member may not see money. */}
                        {offer.total !== null ? formatMoneyShort(offer.total) : ''}
                        {offer.offerSignedAt ? ` · ${t('leads.status.won')}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {others.length > 0 ? (
            <View className="gap-1.5">
              <Text className="text-xs font-medium uppercase text-muted-foreground">
                {t('chat.header.otherThreads')}
              </Text>
              {others.map((thread) => (
                <Pressable
                  key={thread.uuid}
                  onPress={() => router.replace(`/chat/${thread.uuid}`)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2 rounded-lg py-1.5 active:bg-muted"
                >
                  <Ionicons
                    name={thread.awaitingReply ? 'ellipse' : 'ellipse-outline'}
                    size={9}
                    color={thread.awaitingReply ? c.destructive : c.mutedForeground}
                  />
                  <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
                    {thread.preview || t('chat.noMessages')}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {relativeTime(thread.lastMessageAt)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
