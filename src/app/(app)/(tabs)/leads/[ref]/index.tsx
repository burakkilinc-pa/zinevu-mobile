import { useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useLocale, useT, useTFallback } from '@/lib/i18n';
import { formatDateTime } from '@/lib/time';
import { formatMoney } from '@/lib/money';
import { dialCode, toE164 } from '@/lib/phone';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';
import { useDealerForm } from '@/features/leads/hooks/use-leads';
import { lead3dTarget } from '@/features/leads/lead-3d';
import { OfferLinesCard } from '@/features/leads/components/offer-lines-card';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  useEngagement,
  useOfferPdf,
  useReprocessWizard,
  offerKeys,
} from '@/features/leads/hooks/use-offer';

/**
 * One lead, on a phone.
 *
 * This is the whole record, not a summary of it: the offer lines, what the
 * customer has done with the offer so far, and the two routes out — edit the
 * lines, or send it. A dealer standing in the garden they just measured is the
 * person best placed to price it, so the phone stopped being a viewer.
 *
 * Everything that writes lives one screen deeper (./offer, ./send, ./answers),
 * which keeps this page glanceable and each write on a screen of its own.
 */
export default function LeadDetailScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const dock = useDockClearance();
  const t = useT();
  // Answer keys and values come from the dealer's own master form, so they
  // are open-ended — see useTFallback.
  const tf = useTFallback();
  const c = useColors();
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const canManageOffer = hasPermission(user, PERMISSIONS.offersManage);
  const canSend = hasPermission(user, PERMISSIONS.offersSend);
  const canSeePrices = hasPermission(user, PERMISSIONS.pricingView);
  const canSeeForms = hasPermission(user, PERMISSIONS.formsView);

  const query = useQuery({
    queryKey: offerKeys.detail(String(ref)),
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
  });

  const lead = query.data;
  const dealId = lead?.dealId ?? null;

  const engagement = useEngagement(dealId, !!lead?.offerSentAt);
  const reprocess = useReprocessWizard(String(ref), dealId ?? 0);
  const pdf = useOfferPdf(dealId ?? 0);
  // The 3D view is gated on the dealer's own form config, so it can only be
  // offered once that has arrived — see lead-3d.ts.
  const dealerForm = useDealerForm(lead?.formType ?? null, !!lead && canSeeForms);
  const view3d = lead ? lead3dTarget(lead, dealerForm.data ?? null) : null;

  // Numbers are stored the way the customer typed them — "06 12 34 56 78",
  // national and trunk-prefixed. WhatsApp only takes a full international
  // number and rejects anything else as "not on WhatsApp", so the country the
  // lead is in decides what that 0 becomes. See lib/phone.ts.
  const dialable = toE164(
    lead?.customerPhone,
    dialCode(lead?.customerCallingCode, lead?.customerCountry, locale)
  );

  /**
   * Rebuild the lines from the answers.
   *
   * The backend refuses this with a 409 once the offer has left the building,
   * because it overwrites hand-set prices. That refusal is the prompt: ask, and
   * only then force.
   */
  const onReprocess = useCallback(() => {
    reprocess.mutate(false, {
      onSuccess: () => toast.success(t('offer.answers.reprocessed')),
      onError: (error) => {
        const status = (error as { status?: number })?.status;
        if (status !== 409) {
          toast.error((error as Error).message);
          return;
        }
        Alert.alert(
          t('offer.answers.reprocessWarnTitle'),
          t('offer.answers.reprecessWarnBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('offer.answers.reprocess'),
              style: 'destructive',
              onPress: () =>
                reprocess.mutate(true, {
                  onSuccess: () => toast.success(t('offer.answers.reprocessed')),
                  onError: (e) => toast.error((e as Error).message),
                }),
            },
          ]
        );
      },
    });
  }, [reprocess, t]);

  /**
   * The offer as the customer will see it.
   *
   * Regenerated rather than linked: `pdfUrl` is whatever was last built, which
   * is stale the moment a line changes, and a dealer opening this is checking
   * what they are about to send.
   */
  const lastPdfUrl = lead?.pdfUrl ?? null;

  const onPdf = useCallback(() => {
    pdf.mutate(undefined, {
      onSuccess: (url) => {
        if (url) void WebBrowser.openBrowserAsync(url);
        else if (lastPdfUrl) void WebBrowser.openBrowserAsync(lastPdfUrl);
        else toast.error(t('common.error'));
      },
      onError: (error) => toast.error((error as Error).message),
    });
  }, [pdf, lastPdfUrl, t]);

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={lead?.customerName || t('leads.noName')} />

      {query.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : query.isError || !lead ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-destructive">{t('common.error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: dock + 24, gap: 16 }}>
          {lead.previewImageUrl ? (
            <Image
              source={{ uri: lead.previewImageUrl }}
              contentFit="cover"
              transition={150}
              style={{ width: '100%', height: 180, borderRadius: 16 }}
            />
          ) : null}

          {/* What you do from a phone. Reaching the customer and looking at
              what they configured sit together; sending — the one thing here
              that leaves the building — gets its own full-width target so it
              is never the button next to the one you meant. */}
          <View className="flex-row gap-3">
            <ActionButton
              icon="call"
              label={t('leads.detail.call')}
              disabled={!dialable}
              onPress={() => dialable && Linking.openURL(`tel:+${dialable}`)}
            />
            <ActionButton
              icon="logo-whatsapp"
              label="WhatsApp"
              disabled={!dialable}
              onPress={() => dialable && Linking.openURL(`https://wa.me/${dialable}`)}
            />
            <ActionButton
              icon="document-text"
              label={t('leads.detail.pdf')}
              loading={pdf.isPending}
              disabled={!dealId || !canSeePrices}
              onPress={onPdf}
            />
            <ActionButton
              icon="cube"
              label={t('leads.detail.view3d')}
              disabled={!view3d}
              onPress={() =>
                view3d &&
                router.push({
                  pathname: '/web-3d',
                  params: {
                    url: view3d.url,
                    handoff: view3d.handoff,
                    title: t('leads.detail.view3d'),
                  },
                })
              }
            />
          </View>

          {dealId && canSend ? (
            <Pressable
              onPress={() => router.push(`/leads/${lead.ref}/send`)}
              accessibilityRole="button"
              className="flex-row items-center justify-center gap-2 rounded-2xl py-4 active:opacity-90"
              style={{ backgroundColor: c.primary }}
            >
              <Ionicons name="paper-plane" size={18} color={c.background} />
              <Text className="text-base font-semibold" style={{ color: c.background }}>
                {lead.offerSentAt ? t('offer.send.again') : t('offer.send.toCustomer')}
              </Text>
            </Pressable>
          ) : null}

          {/* Corrections landed after the lines were priced — the offer now
              quotes something the customer no longer asked for. */}
          {dealId && lead.answersChangedAt && canManageOffer ? (
            <Card className="gap-3 border-amber-500/40 p-4">
              <Text className="text-sm text-foreground">{t('offer.answers.stale')}</Text>
              <Pressable
                onPress={onReprocess}
                disabled={reprocess.isPending}
                accessibilityRole="button"
                className="flex-row items-center gap-2 self-start rounded-full bg-muted px-3 py-2 active:opacity-80"
              >
                {reprocess.isPending ? (
                  <ActivityIndicator color={c.mutedForeground} />
                ) : (
                  <Ionicons name="refresh" size={16} color={c.foreground} />
                )}
                <Text className="text-sm font-medium text-foreground">
                  {t('offer.answers.reprocess')}
                </Text>
              </Pressable>
            </Card>
          ) : null}

          {dealId ? (
            <OfferLinesCard
              lines={lead.lines}
              settings={lead.offer}
              canSeePrices={canSeePrices && lead.total !== null}
              onEdit={
                canManageOffer && canSeePrices
                  ? () => router.push(`/leads/${lead.ref}/offer`)
                  : undefined
              }
            />
          ) : (
            <Card className="p-4">
              <Text className="text-sm text-muted-foreground">{t('offer.section.noDeal')}</Text>
            </Card>
          )}

          {/* What the customer did with it. Only once something went out — an
              unsent offer has nothing to report and the empty card would just
              be noise on every new lead. */}
          {lead.offerSentAt && engagement.data ? (
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                {t('offer.engagement.title')}
              </Text>
              <Card className="gap-2.5 p-4">
                <EngagementRow
                  icon="paper-plane-outline"
                  done
                  label={t('offer.engagement.sent', { n: engagement.data.emailsSent })}
                  detail={formatDateTime(lead.offerSentAt)}
                />
                <EngagementRow
                  icon="mail-open-outline"
                  done={engagement.data.emailOpens > 0}
                  label={
                    engagement.data.emailOpens > 0
                      ? t('offer.engagement.opened')
                      : t('offer.engagement.notOpened')
                  }
                  detail={
                    engagement.data.firstOpenedAt
                      ? formatDateTime(engagement.data.firstOpenedAt)
                      : null
                  }
                />
                {engagement.data.offerViews > 0 ? (
                  <EngagementRow
                    icon="eye-outline"
                    done
                    label={t('offer.engagement.viewed', { n: engagement.data.offerViews })}
                    detail={
                      engagement.data.lastViewedAt
                        ? formatDateTime(engagement.data.lastViewedAt)
                        : null
                    }
                  />
                ) : null}
                {engagement.data.pdfDownloads > 0 ? (
                  <EngagementRow
                    icon="download-outline"
                    done
                    label={t('offer.engagement.downloaded', { n: engagement.data.pdfDownloads })}
                    detail={null}
                  />
                ) : null}
                {engagement.data.signedAt ? (
                  <EngagementRow
                    icon="checkmark-circle-outline"
                    done
                    label={t('offer.engagement.signed')}
                    detail={formatDateTime(engagement.data.signedAt)}
                  />
                ) : null}
              </Card>
            </View>
          ) : null}

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

          {lead.photoUrls.length > 0 ? (
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">{t('offer.photos')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {lead.photoUrls.map((url) => (
                  <Pressable
                    key={url}
                    onPress={() => WebBrowser.openBrowserAsync(url)}
                    accessibilityRole="imagebutton"
                  >
                    <Image
                      source={{ uri: url }}
                      contentFit="cover"
                      transition={150}
                      style={{ width: 96, height: 96, borderRadius: 12 }}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {lead.answers.length > 0 ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">
                  {t('leads.detail.configuration')}
                </Text>
                {dealId && canManageOffer ? (
                  <Pressable
                    onPress={() => router.push(`/leads/${lead.ref}/answers`)}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="flex-row items-center gap-1 rounded-full px-2 py-1 active:bg-muted"
                  >
                    <Ionicons name="create-outline" size={16} color={c.foreground} />
                    <Text className="text-sm font-medium text-foreground">
                      {t('offer.answers.edit')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Card className="gap-2.5 p-4">
                {lead.answers.map((answer) => (
                  <Row
                    key={answer.key}
                    label={tf(`leads.answer.${answer.key}`, answer.key)}
                    value={tf(`leads.value.${answer.value}`, answer.value)}
                    hint={answer.overridden ? t('offer.answers.corrected') : undefined}
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

function Row({
  label,
  value,
  strong,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="flex-1 items-end">
        <Text className={`text-right text-sm ${strong ? 'font-bold' : ''} text-foreground`}>
          {value}
        </Text>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
    </View>
  );
}

function EngagementRow({
  icon,
  label,
  detail,
  done,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail: string | null;
  done: boolean;
}) {
  const c = useColors();

  return (
    <View className="flex-row items-center gap-3">
      <Ionicons name={icon} size={18} color={done ? c.foreground : c.mutedForeground} />
      <Text className={`flex-1 text-sm ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </Text>
      {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : {}}
      className="flex-1 items-center gap-1.5 rounded-2xl border border-border bg-card py-3.5 active:bg-muted"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.foreground} />
      ) : (
        <Ionicons name={icon} size={20} color={c.foreground} />
      )}
      <Text className="text-xs font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}
