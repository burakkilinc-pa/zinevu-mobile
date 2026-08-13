import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { CARD_CLASS, CARD_SHADOW } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { relativeTime } from '@/lib/time';
import { formatMoneyShort } from '@/lib/money';
import type { FunnelStatus, Lead } from '@/features/leads/types';

/**
 * One request, as a card.
 *
 * The picture leads because it is the fastest way to recognise a lead — a
 * dealer scrolling their morning list knows "the crème free-standing one" long
 * before they know the name. It is a render of what this customer actually
 * configured (resolved server-side, see App\Support\LeadPreviewImage), not
 * stock photography, so it is worth the space.
 *
 * A request with no configuration shows a plain tile instead. It must not
 * borrow another lead's picture, and it must not be hidden either: a Meta lead
 * is still a lead, it just came in as a name and a phone number.
 */

const STATUS_TONE: Record<FunnelStatus, 'neutral' | 'info' | 'good' | 'bad'> = {
  processing: 'neutral',
  needs_review: 'bad',
  offer_draft: 'neutral',
  offer_sent: 'info',
  won: 'good',
  lost: 'bad',
};

export function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const t = useT();
  const c = useColors();

  const tone = STATUS_TONE[lead.status];
  const toneColor =
    tone === 'good' ? c.success : tone === 'bad' ? c.destructive : tone === 'info' ? c.foreground : c.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`${CARD_CLASS} mb-3 overflow-hidden active:opacity-90`}
      style={CARD_SHADOW}
    >
      <View className="h-40 w-full bg-muted">
        {lead.previewImageUrl ? (
          <Image
            source={{ uri: lead.previewImageUrl }}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-1.5">
            <Ionicons name="cube-outline" size={26} color={c.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {t('leads.noConfiguration')}
            </Text>
          </View>
        )}
      </View>

      <View className="gap-2 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>
            {lead.customerName || t('leads.noName')}
          </Text>
          {/* Money is null — not zero — for a member who may not see it, so an
              absent price renders as nothing rather than "€ 0,00". */}
          {lead.total !== null ? (
            <Text className="text-base font-bold text-foreground">
              {formatMoneyShort(lead.total)}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2">
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneColor }} />
          <Text className="text-xs" style={{ color: toneColor }}>
            {t(`leads.status.${lead.status}` as MessageKey)}
          </Text>
          <Text className="text-xs text-muted-foreground">·</Text>
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {relativeTime(lead.createdAt)}
            {lead.offerNo ? ` · ${lead.offerNo}` : ''}
          </Text>
        </View>

        {/* The customer's own words. Shown on the card because it is the one
            part of a request that no configuration answer restates — and often
            the reason to call them first. */}
        {lead.hasNote ? (
          <View className="flex-row items-start gap-1.5">
            <Ionicons name="chatbox-ellipses-outline" size={13} color={c.mutedForeground} />
            <Text className="flex-1 text-xs italic text-muted-foreground" numberOfLines={2}>
              {lead.noteExcerpt || t('leads.hasNote')}
            </Text>
          </View>
        ) : null}

        {lead.relatedCount > 1 ? (
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="link-outline" size={13} color={c.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {t('leads.related', { n: lead.relatedCount - 1 })}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
