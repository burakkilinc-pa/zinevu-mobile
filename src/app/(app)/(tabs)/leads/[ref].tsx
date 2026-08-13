import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT, useTFallback } from '@/lib/i18n';
import { formatDateTime } from '@/lib/time';
import { formatMoney } from '@/lib/money';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';

/**
 * One lead, on a phone.
 *
 * Carries what you need to decide whether to call, and then lets you call. The
 * desk page's offer editor, mail history and pricing breakdown are not here:
 * they are things done sitting down, and putting a cramped version of them on a
 * phone would only make both worse.
 */
export default function LeadDetailScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const t = useT();
  // Answer keys and values come from the dealer's own master form, so they
  // are open-ended — see useTFallback.
  const tf = useTFallback();
  const c = useColors();
  const router = useRouter();

  const query = useQuery({
    queryKey: ['leads', 'detail', ref],
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
  });

  const lead = query.data;

  // Strip anything a dialler would choke on. A number stored as
  // "06 12 34 56 78" is common and dials fine once the spaces are gone.
  const dialable = lead?.customerPhone?.replace(/[^\d+]/g, '') || null;

  return (
    <Screen padded={false} edges={['top']}>
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
          {lead?.customerName || t('leads.noName')}
        </Text>
      </View>

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : query.isError || !lead ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-destructive">{t('common.error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}>
          {lead.previewImageUrl ? (
            <Image
              source={{ uri: lead.previewImageUrl }}
              contentFit="cover"
              transition={150}
              style={{ width: '100%', height: 180, borderRadius: 16 }}
            />
          ) : null}

          {/* The two things you do from a phone. Big, side by side, no menu. */}
          <View className="flex-row gap-3">
            <ActionButton
              icon="call"
              label={t('leads.detail.call')}
              disabled={!dialable}
              onPress={() => dialable && Linking.openURL(`tel:${dialable}`)}
            />
            <ActionButton
              icon="logo-whatsapp"
              label="WhatsApp"
              disabled={!dialable}
              // wa.me wants the international number without a plus or zeroes.
              onPress={() =>
                dialable && Linking.openURL(`https://wa.me/${dialable.replace(/^\+/, '')}`)
              }
            />
            <ActionButton
              icon="document-text"
              label={t('leads.detail.offer')}
              disabled={!lead.pdfUrl}
              onPress={() => lead.pdfUrl && WebBrowser.openBrowserAsync(lead.pdfUrl)}
            />
          </View>

          <Card className="gap-3 p-4">
            {lead.total !== null ? (
              <Row label={t('leads.detail.total')} value={formatMoney(lead.total)} strong />
            ) : null}
            {lead.offerNo ? <Row label={t('leads.detail.offerNo')} value={lead.offerNo} /> : null}
            {lead.customerPhone ? (
              <Row label={t('leads.detail.phone')} value={lead.customerPhone} />
            ) : null}
            {lead.customerEmail ? (
              <Row label={t('leads.detail.email')} value={lead.customerEmail} />
            ) : null}
            {lead.customerAddress ? (
              <Row label={t('leads.detail.address')} value={lead.customerAddress} />
            ) : null}
            <Row label={t('leads.detail.received')} value={formatDateTime(lead.createdAt)} />
            {lead.offerSentAt ? (
              <Row label={t('leads.detail.sent')} value={formatDateTime(lead.offerSentAt)} />
            ) : null}
            {lead.offerSignedAt ? (
              <Row label={t('leads.detail.signed')} value={formatDateTime(lead.offerSignedAt)} />
            ) : null}
          </Card>

          {lead.note ? (
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                {t('leads.detail.note')}
              </Text>
              <Card className="p-4">
                <Text className="text-sm italic leading-5 text-foreground">{lead.note}</Text>
              </Card>
            </View>
          ) : null}

          {lead.answers.length > 0 ? (
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                {t('leads.detail.configuration')}
              </Text>
              <Card className="gap-2.5 p-4">
                {lead.answers.map((answer) => (
                  <Row
                    key={answer.key}
                    label={tf(`leads.answer.${answer.key}`, answer.key)}
                    value={tf(`leads.value.${answer.value}`, answer.value)}
                  />
                ))}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text
        className={`flex-1 text-right text-sm ${strong ? 'font-bold' : ''} text-foreground`}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : {}}
      className="flex-1 items-center gap-1.5 rounded-2xl border border-border bg-card py-3.5 active:bg-muted"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Ionicons name={icon} size={20} color={c.foreground} />
      <Text className="text-xs font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}
