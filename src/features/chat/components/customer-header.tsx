import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { formatMoneyShort } from '@/lib/money';
import { relativeTime } from '@/lib/time';
import type { ChatConversationDetail, ChatCustomer } from '@/features/chat/types';

/**
 * Who you are talking to, above the conversation.
 *
 * The phone used to show a name and nothing else — twice, in fact: once in the
 * navigation bar and once in the card below it. So a dealer answering from a
 * roof could not tell whether the question came from the 3D configurator or a
 * contact form, which page it was about, or whether the person was still
 * standing on it. The desk has had all of that on its visitor card since day
 * one; this is the same answer to "kim, nereden, hangi sayfada", shaped for a
 * phone.
 *
 * Always one bar, never two, and the expandable part renders nothing at all
 * while it is closed — the details used to arrive from a second request and
 * push the whole conversation down the screen a moment after it opened.
 *
 * What is behind the chevron, in the order a dealer asks for it:
 *   - the page they are on now, tappable (that IS the question, usually),
 *   - where they are, on what, in which language,
 *   - their offers, because "which quote do they mean" is the next question,
 *   - their OTHER conversations: the customer does not know they opened a
 *     second chat, and answering in the wrong one is how a thread ends up
 *     with two half-conversations in it.
 */
export function ConversationHeader({
  detail,
  customer,
  customerLoading,
  currentThread,
  open,
  onToggle,
  onBack,
}: {
  detail: ChatConversationDetail | null;
  customer: ChatCustomer | null;
  customerLoading: boolean;
  currentThread: string;
  open: boolean;
  onToggle: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const c = useColors();
  const router = useRouter();

  const name =
    detail?.name || customer?.name || detail?.email || customer?.email || t('chat.anonymous');
  const phone = (detail?.phone || customer?.phone)?.replace(/[^\d+]/g, '') || null;
  const others = (customer?.conversations ?? []).filter((conv) => conv.uuid !== currentThread);
  const offers = customer?.offers ?? [];

  const place = [detail?.city, detail?.country].filter(Boolean).join(', ');
  const surface = surfaceLabel(t, detail?.surface);

  return (
    <View className="border-b border-border bg-card">
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>

        <View className="min-w-0 flex-1 pr-1">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {name}
          </Text>
          {/* Online, and on what. Both in one line because they answer one
              question: is it worth typing the next sentence right now. */}
          <View className="flex-row items-center gap-1.5">
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: detail?.present ? (c.success ?? '#22c55e') : c.border }}
            />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              {detail
                ? [detail.present ? t('chat.onPage') : t('chat.leftPage'), surface, place]
                    .filter(Boolean)
                    .join(' · ')
                : ' '}
            </Text>
          </View>
        </View>

        {phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${phone}`)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('leads.detail.call')}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
          >
            <Ionicons name="call-outline" size={18} color={c.foreground} />
          </Pressable>
        ) : null}

        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('chat.header.toggle')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons
            name={open ? 'chevron-up' : 'information-circle-outline'}
            size={19}
            color={c.foreground}
          />
        </Pressable>
      </View>

      {open ? (
        <View className="gap-3 border-t border-border px-4 py-3">
          {detail?.currentUrl ? (
            <Pressable
              onPress={() => Linking.openURL(detail.currentUrl as string)}
              accessibilityRole="link"
              className="gap-0.5"
            >
              <Label>{t('chat.header.page')}</Label>
              <Text className="text-sm text-foreground underline" numberOfLines={2}>
                {prettyUrl(detail.currentUrl)}
              </Text>
            </Pressable>
          ) : null}

          {detail?.currentStepKey ? (
            <Fact label={t('chat.header.step')}>{detail.currentStepKey}</Fact>
          ) : null}

          {detail?.email || detail?.phone ? (
            <Fact label={t('chat.header.contact')}>
              {[detail.email, detail.phone].filter(Boolean).join(' · ')}
            </Fact>
          ) : null}

          {detail?.deviceType || detail?.locale ? (
            <Fact label={t('chat.header.device')}>
              {[detail.deviceType, detail.locale?.toUpperCase()].filter(Boolean).join(' · ')}
            </Fact>
          ) : null}

          {detail?.firstSeenAt ? (
            <Fact label={t('chat.header.firstSeen')}>{relativeTime(detail.firstSeenAt)}</Fact>
          ) : null}

          {customerLoading ? (
            <ActivityIndicator color={c.mutedForeground} />
          ) : (
            <>
              {offers.length > 0 ? (
                <View className="gap-1.5">
                  <Label>{t('chat.header.offers')}</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-2">
                      {offers.map((offer) => (
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
                  <Label>{t('chat.header.otherThreads')}</Label>
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
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text className="text-xs font-medium uppercase text-muted-foreground">{children}</Text>
  );
}

function Fact({ label, children }: { label: string; children: string }) {
  return (
    <View className="gap-0.5">
      <Label>{label}</Label>
      <Text className="text-sm text-foreground">{children}</Text>
    </View>
  );
}

/** Which of our surfaces they opened the chat from. */
export function surfaceLabel(t: ReturnType<typeof useT>, surface?: string | null): string {
  if (!surface) return '';
  const known = ['form', '3d', 'site', 'offer'];
  return known.includes(surface) ? t(`chat.surface.${surface}` as MessageKey) : surface;
}

/** The address without the ceremony — a phone has no room for the scheme. */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
