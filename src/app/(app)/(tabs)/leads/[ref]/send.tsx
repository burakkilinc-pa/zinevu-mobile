import { useCallback } from 'react';
import { ActivityIndicator, Alert, Share, Text, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { formatDate, formatDateTime } from '@/lib/time';
import { formatMoney } from '@/lib/money';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';
import { computeTotals } from '@/features/leads/offer-totals';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  offerKeys,
  useCustomerTokens,
  useIssueCustomerToken,
  useOfferPdf,
  useSendOffer,
  useSendTestOffer,
} from '@/features/leads/hooks/use-offer';

/**
 * Putting the offer in front of the customer.
 *
 * Three ways out, in the order a dealer reaches for them: check the PDF, send a
 * test to yourself, send it for real. The real send is the only irreversible
 * one — it mints the offer number and mails the customer — so it asks first and
 * says exactly who is about to receive what.
 *
 * There is no subject/body editor here on purpose: the mail is composed from
 * the dealer's own template in the portal, and re-typing it on a phone would be
 * a second, worse copy of a thing they already own.
 */
export default function SendOfferScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const dock = useDockClearance();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const allowed = hasPermission(user, PERMISSIONS.offersSend);

  const detail = useQuery({
    queryKey: offerKeys.detail(String(ref)),
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
  });

  const lead = detail.data;
  const dealId = lead?.dealId ?? null;

  const send = useSendOffer(String(ref), dealId ?? 0);
  const sendTest = useSendTestOffer(dealId ?? 0);
  const pdf = useOfferPdf(dealId ?? 0);
  const tokens = useCustomerTokens(allowed ? dealId : null);
  const issueToken = useIssueCustomerToken(dealId ?? 0);

  const activeToken = tokens.data?.find((token) => token.isActive) ?? null;

  const total = lead
    ? computeTotals(
        lead.lines.map((l) => ({ quantity: l.quantity, price: l.price, vatRate: l.vatRate })),
        lead.offer.discountRate,
        lead.offer.finalTotalOverride
      ).total
    : 0;

  const onSend = useCallback(() => {
    if (!lead) return;
    if (lead.lines.length === 0) {
      toast.error(t('offer.send.noLines'));
      return;
    }
    if (!lead.customerEmail) {
      toast.error(t('offer.send.noEmail'));
      return;
    }

    Alert.alert(
      t('offer.send.confirmTitle'),
      t('offer.send.confirmBody', {
        name: lead.customerName ?? '',
        total: formatMoney(total),
        email: lead.customerEmail,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('offer.send.action'),
          onPress: () =>
            send.mutate(undefined, {
              onSuccess: () => {
                toast.success(t('offer.send.sent'));
                router.back();
              },
              // The refusals worth expecting here — live delivery switched off,
              // an unfinished onboarding step, a spent plan quota — all arrive
              // with the backend's own sentence, which is the accurate one.
              onError: (error) => toast.error((error as Error).message),
            }),
        },
      ]
    );
  }, [lead, total, send, router, t]);

  const onShareLink = useCallback(
    (url: string) =>
      Share.share({ message: url }).catch(() => {
        void Clipboard.setStringAsync(url);
      }),
    []
  );

  if (!allowed) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title={t('offer.send.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-muted-foreground">
            {t('offer.noPermission')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('offer.send.title')} />

      {detail.isLoading || !lead ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: dock + 24, gap: 16 }}>
          <Card className="gap-3 p-4">
            <Row label={t('leads.detail.email')} value={lead.customerEmail ?? '—'} />
            <Row label={t('offer.total.total')} value={formatMoney(total)} strong />
            {lead.offerNo ? (
              <Row label={t('leads.detail.offerNo')} value={lead.offerNo} />
            ) : (
              <Text className="text-xs text-muted-foreground">{t('offer.send.numberHint')}</Text>
            )}
            {lead.offerSentAt ? (
              <Row label={t('leads.detail.sent')} value={formatDateTime(lead.offerSentAt)} />
            ) : null}
          </Card>

          <View className="gap-3">
            <Button
              title={lead.offerSentAt ? t('offer.send.again') : t('offer.send.toCustomer')}
              icon="paper-plane"
              loading={send.isPending}
              onPress={onSend}
            />
            <Button
              title={t('offer.send.test')}
              variant="outline"
              icon="mail-outline"
              loading={sendTest.isPending}
              onPress={() =>
                sendTest.mutate(undefined, {
                  onSuccess: () => toast.success(t('offer.send.testSent')),
                  onError: (error) => toast.error((error as Error).message),
                })
              }
            />
            <Button
              title={t('offer.send.pdf')}
              variant="outline"
              icon="document-text-outline"
              loading={pdf.isPending}
              onPress={() =>
                pdf.mutate(undefined, {
                  onSuccess: (url) => {
                    if (url) void WebBrowser.openBrowserAsync(url);
                    else toast.error(t('common.error'));
                  },
                  onError: (error) => toast.error((error as Error).message),
                })
              }
            />
          </View>

          {/* The link the customer signs on. Issuing one revokes the previous
              live link, and the raw URL is shown exactly once — the backend
              only ever stores its hash — so it goes straight to the share
              sheet rather than being kept around to display later. */}
          <View className="gap-2">
            <Text className="text-base font-semibold text-foreground">{t('offer.link.title')}</Text>
            <Card className="gap-3 p-4">
              {activeToken ? (
                <View className="gap-0.5">
                  <Text className="text-sm text-foreground">
                    {t('offer.link.active', { date: formatDate(activeToken.expiresAt) })}
                  </Text>
                  {activeToken.viewCount > 0 ? (
                    <Text className="text-xs text-muted-foreground">
                      {t('offer.link.views', { n: activeToken.viewCount })}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className="text-sm text-muted-foreground">{t('offer.link.none')}</Text>
              )}

              <Button
                title={t('offer.link.issue')}
                variant="outline"
                icon="link-outline"
                loading={issueToken.isPending}
                onPress={() =>
                  issueToken.mutate(undefined, {
                    onSuccess: ({ url }) => void onShareLink(url),
                    onError: (error) => toast.error((error as Error).message),
                  })
                }
              />
            </Card>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className={`flex-1 text-right text-sm ${strong ? 'font-bold' : ''} text-foreground`}>
        {value}
      </Text>
    </View>
  );
}
