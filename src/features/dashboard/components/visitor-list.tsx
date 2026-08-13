import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import type { LiveVisitor } from '@/features/dashboard/types';

/**
 * Who is on the dealer's site right now — the panel that answers "who, from
 * where, how far in" before a word is typed.
 *
 * Visitors are anonymous by nature: the backend has a city and a device, and
 * nothing else until they leave a request. So each row leads with where they
 * are in the funnel, which is the only thing that makes one worth interrupting
 * for. A visitor who already opened a chat is tappable straight into it.
 */
const DEVICE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mobile: 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  desktop: 'desktop-outline',
};

export function VisitorList({ visitors }: { visitors: LiveVisitor[] }) {
  const t = useT();
  const c = useColors();
  const router = useRouter();

  if (visitors.length === 0) {
    return (
      <Card className="items-center gap-1.5 p-6">
        <Text className="text-sm text-muted-foreground">{t('dash.visitors.empty')}</Text>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {visitors.map((visitor, index) => {
        const place = [visitor.city, visitor.countryCode].filter(Boolean).join(', ');
        const stage = visitor.converted
          ? t('dash.visitors.stageConverted')
          : visitor.started
            ? t('dash.visitors.stageInForm')
            : t('dash.visitors.stageBrowsing');

        const row = (
          <View
            className="flex-row items-center gap-3 px-4 py-3"
            style={index > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}
          >
            {/* A live dot alone would be colour-only, so it sits next to the
                device icon and the "seen" time, which say the same thing. */}
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: visitor.awaitingReply ? c.destructive : c.success }}
            />
            <Ionicons
              name={DEVICE_ICON[visitor.deviceType ?? ''] ?? 'globe-outline'}
              size={16}
              color={c.mutedForeground}
            />
            <View className="flex-1">
              <Text className="text-[15px] text-foreground" numberOfLines={1}>
                {place || t('dash.visitors.unknownPlace')}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {stage}
                {visitor.utmSource ? ` · ${visitor.utmSource}` : ''}
                {visitor.lastSeenAt ? ` · ${relativeTime(visitor.lastSeenAt)}` : ''}
              </Text>
            </View>
            {visitor.hasChat ? (
              <Ionicons
                name={visitor.awaitingReply ? 'chatbubble-ellipses' : 'chatbubble-outline'}
                size={16}
                color={visitor.awaitingReply ? c.destructive : c.mutedForeground}
              />
            ) : null}
          </View>
        );

        return visitor.conversationId ? (
          <Pressable
            key={visitor.sessionId}
            accessibilityRole="button"
            onPress={() => router.push(`/chat/${visitor.conversationId}` as never)}
            className="active:bg-muted"
          >
            {row}
          </Pressable>
        ) : (
          <View key={visitor.sessionId}>{row}</View>
        );
      })}
    </Card>
  );
}
