import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { useTickets } from '@/features/support/hooks/use-support';
import type { Ticket, TicketStatus } from '@/features/support/api/support.api';

/**
 * Support — the dealer's tickets with Zinevu.
 *
 * Not to be confused with the live chat, which is the dealer talking to their
 * own customers. Different other side, different screen.
 */
export default function SupportScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();
  const query = useTickets();

  const tickets = query.data ?? [];

  // Only a pull drives the spinner — the ticket list polls on its own every
  // 30s, and `isRefetching` would show the control for each of those.
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  return (
    <Screen padded={false} edges={['top']}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={30} color={c.foreground} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-foreground">
          {t('tabs.support')}
        </Text>
        <Pressable
          onPress={() => router.push('/settings/support/new')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('support.new.action')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="add" size={24} color={c.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: bottom, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void onRefresh()}
            tintColor={c.mutedForeground}
          />
        }
      >
        {query.isLoading ? (
          <ActivityIndicator className="mt-16" color={c.mutedForeground} />
        ) : tickets.length === 0 ? (
          <View className="items-center gap-3 py-16">
            <Ionicons name="help-buoy-outline" size={28} color={c.mutedForeground} />
            <Text className="text-base text-muted-foreground">
              {query.isError ? t('common.error') : t('support.empty')}
            </Text>
            <Pressable
              onPress={() => router.push('/settings/support/new')}
              accessibilityRole="button"
              className="mt-2 rounded-full px-5 py-3"
              style={{ backgroundColor: c.primary }}
            >
              <Text className="text-sm font-semibold" style={{ color: c.background }}>
                {t('support.new.action')}
              </Text>
            </Pressable>
          </View>
        ) : (
          tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onPress={() => router.push(`/settings/support/${ticket.id}`)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function TicketRow({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  const t = useT();
  const c = useColors();

  // Only 'answered' earns a colour: it is the one state that is about US —
  // Zinevu replied and it is our move. The rest are the ticket's own life.
  const tone: Record<TicketStatus, string> = {
    open: c.mutedForeground,
    answered: c.success,
    resolved: c.mutedForeground,
    closed: c.mutedForeground,
  };

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card className="gap-2 p-4 active:opacity-90">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={2}>
            {ticket.subject}
          </Text>
          {ticket.unread ? (
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: c.destructive }} />
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <Text className="text-xs" style={{ color: tone[ticket.status] }}>
            {t(`support.status.${ticket.status}` as MessageKey)}
          </Text>
          <Text className="text-xs text-muted-foreground">·</Text>
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {ticket.referenceNo ? `${ticket.referenceNo} · ` : ''}
            {relativeTime(ticket.lastMessageAt ?? ticket.createdAt)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
