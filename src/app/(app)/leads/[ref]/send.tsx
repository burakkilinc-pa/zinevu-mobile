import { useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Share, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Directory, File, Paths } from 'expo-file-system';

import { Screen } from '@/components/ui/screen';
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
  useSendOfferWhatsapp,
  useSendTestOffer,
  useWhatsappCapability,
} from '@/features/leads/hooks/use-offer';
import type { WhatsappSendResult } from '@/features/leads/api/offer.api';

/**
 * Putting the offer in front of the customer.
 *
 * Three ways out, in the order a dealer reaches for them: check the PDF, send a
 * test to yourself, send it for real. The real send is the only irreversible
 * one — it mints the offer number and reaches the customer — so it asks first
 * and says exactly who is about to receive what.
 *
 * There is no subject/body editor here on purpose: the mail is composed from
 * the dealer's own template in the portal, and re-typing it on a phone would be
 * a second, worse copy of a thing they already own.
 *
 * WhatsApp is a second real send, down the customer's own channel. What it
 * does depends on the answer the server gives, and the two outcomes are
 * genuinely different jobs — see onSendWhatsapp.
 */
export default function SendOfferScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  // The dock does not reach this screen — it is pushed over the tabs, not
  // inside one (see (app)/_layout) — so the bottom only owes the safe area.
  const bottom = useSafeAreaInsets().bottom;
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
  const sendWhatsapp = useSendOfferWhatsapp(String(ref), dealId ?? 0);
  const whatsapp = useWhatsappCapability(allowed ? dealId : null);
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

  /**
   * Hand the prepared message to WhatsApp, file and all.
   *
   * The clipboard step is the design, not a workaround: no share sheet on
   * either platform can give WhatsApp a file AND a pre-filled caption at the
   * same time, and RN's own Share does it unreliably on iOS and not at all on
   * Android. One behaviour on both phones is worth more than one saved paste,
   * and the screen says so out loud.
   */
  const handOff = useCallback(
    async (result: WhatsappSendResult) => {
      await Clipboard.setStringAsync(result.text);

      const attachment = result.attachment;

      if (attachment && (await Sharing.isAvailableAsync())) {
        try {
          // Downloaded rather than linked: the share sheet needs a local file,
          // and the dealer is about to hand this exact document to a customer.
          const dir = new Directory(Paths.cache, 'offers');
          if (!dir.exists) dir.create({ intermediates: true });

          // Downloaded to a NAMED file, not just into the directory: left to
          // itself the download takes its name from the stored media, which
          // is a random hash — and that hash is what the customer would see
          // in their chat and in their downloads folder. `idempotent` because
          // a dealer who sends twice must not hit DestinationAlreadyExists.
          //
          // No auth header: the offer PDF is served from the media disk at an
          // unguessable public URL, the same address the "View PDF" button
          // above opens in a browser.
          const file = await File.downloadFileAsync(
            attachment.url,
            new File(dir, attachment.fileName),
            { idempotent: true }
          );

          await Sharing.shareAsync(file.uri, {
            mimeType: attachment.mime,
            UTI: 'com.adobe.pdf',
            dialogTitle: t('offer.send.whatsapp'),
          });

          return;
        } catch {
          // No file, but the message still has the link in it — falling
          // through to the chat is better than stopping here.
        }
      }

      const chat = result.appUrl ?? result.url;
      if (chat) {
        const opened = await Linking.openURL(chat).then(
          () => true,
          () => false
        );
        if (!opened) toast.error(t('offer.send.whatsappNoApp'));
      }
    },
    [t]
  );

  /**
   * Ask whether the chat really left, and only then book the offer as sent.
   *
   * We never find out by ourselves: the dealer leaves the app, picks a chat we
   * cannot see and taps send in someone else's UI. Stamping on the way out
   * would leave deals reading "sent" for messages nobody wrote.
   */
  const askIfItLeft = useCallback(() => {
    Alert.alert(
      t('offer.send.whatsappConfirmTitle'),
      `${t('offer.send.whatsappConfirmBody', { name: lead?.customerName ?? '' })}`,
      [
        { text: t('offer.send.whatsappLater'), style: 'cancel' },
        {
          text: t('offer.send.whatsappConfirmAction'),
          onPress: () =>
            sendWhatsapp.mutate(
              { transport: 'link', confirm: true },
              {
                onSuccess: () => {
                  toast.success(t('offer.send.sent'));
                  router.back();
                },
                onError: (error) => toast.error((error as Error).message),
              }
            ),
        },
      ]
    );
  }, [lead?.customerName, sendWhatsapp, router, t]);

  const onSendWhatsapp = useCallback(() => {
    if (!lead) return;
    if (lead.lines.length === 0) {
      toast.error(t('offer.send.noLines'));
      return;
    }
    // Unlike the mail, this one needs a number and not an address — the whole
    // reason a dealer reaches for it.
    if (!whatsapp.data?.phone && !lead.customerPhone) {
      toast.error(t('offer.send.noPhone'));
      return;
    }

    sendWhatsapp.mutate(
      { transport: 'auto' },
      {
        onSuccess: (result) => {
          // Already gone, from the dealer's own business number, with the PDF
          // attached. Nothing to open and nothing to ask.
          if (result.transport === 'cloud') {
            toast.success(t('offer.send.whatsappCloudSent'));
            router.back();
            return;
          }

          toast.success(t('offer.send.whatsappPasteHint'));
          void handOff(result).then(askIfItLeft);
        },
        onError: (error) => toast.error((error as Error).message),
      }
    );
  }, [lead, whatsapp.data?.phone, sendWhatsapp, handOff, askIfItLeft, router, t]);

  /**
   * What the WhatsApp button will do, said before it is pressed.
   *
   * The capability endpoint answers this for free (it mints nothing), and the
   * two routes are genuinely different jobs: one sends from the dealer's own
   * business number with the PDF attached, the other hands the message to the
   * phone's WhatsApp and waits to be told it left. A button that looks the same
   * in both cases teaches the dealer to distrust it.
   */
  const wa = whatsapp.data;
  const waRoute = wa?.recommended ?? null;
  // Only a loaded answer may disable it. Until then the button stays live —
  // the send itself refuses properly, and a button greyed out by a slow
  // request reads as a broken feature.
  const waBlocked = !!wa && waRoute === null;
  const waHint = !wa
    ? null
    : waRoute === 'cloud'
      ? t('offer.send.whatsappHintCloud')
      : waRoute === 'link'
        ? t('offer.send.whatsappHintLink')
        : wa.quotaAllowed
          ? t('offer.send.noPhone')
          : t('offer.send.whatsappQuota');

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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottom + 24, gap: 16 }}>
          <Card className="gap-3 p-4">
            <Row label={t('leads.detail.email')} value={lead.customerEmail ?? '—'} />
            <Row label={t('leads.detail.phone')} value={lead.customerPhone ?? '—'} />
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
            <View className="gap-1">
              <Button
                title={t('offer.send.whatsapp')}
                variant="outline"
                icon="logo-whatsapp"
                loading={sendWhatsapp.isPending}
                disabled={!dealId || waBlocked}
                onPress={onSendWhatsapp}
              />
              {waHint ? (
                <Text className="px-1 text-xs text-muted-foreground">{waHint}</Text>
              ) : null}
            </View>
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
