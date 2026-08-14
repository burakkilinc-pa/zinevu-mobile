import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';
import type { OfferLine, OfferSettings } from '@/features/leads/api/offer.api';
import { computeTotals } from '@/features/leads/offer-totals';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import {
  offerKeys,
  useOfferLines,
  usePinPrices,
  usePriceCheck,
  useSaveOffer,
} from '@/features/leads/hooks/use-offer';

/** Monotonic across the module — an unsaved line keeps its identity. */
let nextClientKey = 1;

/**
 * The offer editor, on a phone.
 *
 * One screen, one save. The endpoint behind it is a bulk REPLACE — whatever
 * this screen is holding becomes the offer — so the whole line set is edited
 * locally and written once, rather than each field firing its own request. It
 * also means a half-finished edit is never on the customer's offer.
 *
 * Prices are unit prices EX VAT, which is how the backend stores them and how
 * the price list quotes them. The summary block is the only place VAT appears,
 * and it is computed with the backend's own (slightly odd) formula — see
 * offer-totals.ts.
 */
export default function OfferEditorScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const dock = useDockClearance();
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const allowed =
    hasPermission(user, PERMISSIONS.offersManage) && hasPermission(user, PERMISSIONS.pricingView);

  const detail = useQuery({
    queryKey: offerKeys.detail(String(ref)),
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
  });

  const dealId = detail.data?.dealId ?? null;
  const linesQuery = useOfferLines(allowed ? dealId : null);
  const save = useSaveOffer(String(ref), dealId ?? 0);
  const pin = usePinPrices(String(ref), dealId ?? 0);

  // The draft is null until the dealer touches something, and the server copy
  // shows through until then. Seeding it from an effect instead would either
  // cascade a render on open, or (worse, once an invalidation lands mid-edit)
  // overwrite what they are typing.
  const [draftLines, setDraftLines] = useState<OfferLine[] | null>(null);
  const [draftSettings, setDraftSettings] = useState<OfferSettings | null>(null);
  const [showPriceCheck, setShowPriceCheck] = useState(false);

  const priceCheck = usePriceCheck(dealId, showPriceCheck);

  const lines = draftLines ?? linesQuery.data ?? null;
  const settings = draftSettings ?? detail.data?.offer ?? null;
  const dirty = draftLines !== null || draftSettings !== null;

  const patchLine = useCallback(
    (index: number, patch: Partial<OfferLine>) => {
      if (!lines) return;
      setDraftLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    },
    [lines]
  );

  const removeLine = useCallback(
    (index: number) => {
      if (!lines) return;
      setDraftLines(lines.filter((_, i) => i !== index));
    },
    [lines]
  );

  const addLine = useCallback(() => {
    const current = lines ?? [];
    setDraftLines([
      ...current,
      {
        id: null,
        clientKey: `new-${nextClientKey++}`,
        productId: null,
        metaMappingId: null,
        name: '',
        description: null,
        quantity: 1,
        price: 0,
        // Follow the line above rather than assume: 21% is the Dutch general
        // rate, but a dealer quoting installation on an old house is at 9%.
        vatRate: current[current.length - 1]?.vatRate ?? 21,
        total: 0,
        pricePinned: false,
      },
    ]);
  }, [lines]);

  const patchSettings = useCallback(
    (patch: Partial<OfferSettings>) => {
      if (!settings) return;
      setDraftSettings({ ...settings, ...patch });
    },
    [settings]
  );

  const totals = useMemo(
    () =>
      computeTotals(
        (lines ?? []).map((l) => ({ quantity: l.quantity, price: l.price, vatRate: l.vatRate })),
        settings?.discountRate ?? 0,
        settings?.finalTotalOverride ?? null
      ),
    [lines, settings]
  );

  const onSave = useCallback(() => {
    if (!lines || !settings) return;
    if (lines.some((l) => l.name.trim() === '')) {
      toast.error(t('offer.edit.nameRequired'));
      return;
    }
    save.mutate(
      { lines, settings },
      {
        onSuccess: () => {
          // Drop the draft so the (now authoritative) server copy shows again
          // if this screen is reopened before the invalidation settles.
          setDraftLines(null);
          setDraftSettings(null);
          toast.success(t('offer.edit.saved'));
          router.back();
        },
        onError: (error) => toast.error((error as Error).message),
      }
    );
  }, [lines, settings, save, router, t]);

  const onBack = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(t('offer.edit.discardTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('offer.edit.discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty, router, t]);

  if (!allowed) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title={t('offer.edit.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-muted-foreground">
            {t('offer.noPermission')}
          </Text>
        </View>
      </Screen>
    );
  }

  const loading = detail.isLoading || linesQuery.isLoading || lines === null || settings === null;

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('offer.edit.title')} onBack={onBack} />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: dock + 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {lines.map((line, index) => (
              <LineEditor
                key={line.id ?? line.clientKey ?? `row-${index}`}
                line={line}
                onChange={(patch) => patchLine(index, patch)}
                onRemove={() => removeLine(index)}
              />
            ))}

            <Button
              title={t('offer.edit.addLine')}
              variant="outline"
              icon="add"
              onPress={addLine}
            />

            {/* What the price list would charge today. Fetched only when
                opened — it re-runs the pricing engine over the whole deal. */}
            <View className="gap-2">
              <Pressable
                onPress={() => setShowPriceCheck((v) => !v)}
                accessibilityRole="button"
                className="flex-row items-center gap-2 py-1"
              >
                <Ionicons
                  name={showPriceCheck ? 'chevron-down' : 'chevron-forward'}
                  size={18}
                  color={c.foreground}
                />
                <Text className="text-base font-semibold text-foreground">
                  {t('offer.price.title')}
                </Text>
              </Pressable>

              {showPriceCheck ? (
                <PriceCheckPanel
                  loading={priceCheck.isLoading}
                  lines={(priceCheck.data ?? []).filter((l) => l.listPrice !== null)}
                  busy={pin.isPending}
                  onTake={(name, listPrice) => {
                    const index = lines.findIndex((l) => l.name === name);
                    if (index >= 0) patchLine(index, { price: listPrice });
                  }}
                  onTogglePin={(name, pinned, price) =>
                    pin.mutate([{ name, pinned, price }], {
                      onSuccess: () => {
                        toast.success(t('offer.price.pinSaved'));
                        void priceCheck.refetch();
                      },
                      onError: (error) => toast.error((error as Error).message),
                    })
                  }
                />
              ) : null}
            </View>

            <Card className="gap-4 p-4">
              <TextField
                label={t('offer.edit.discountRate')}
                keyboardType="decimal-pad"
                defaultValue={settings.discountRate ? String(settings.discountRate) : ''}
                onChangeText={(text) =>
                  patchSettings({ discountRate: parseMoneyInput(text) ?? 0 })
                }
              />
              <TextField
                label={t('offer.edit.finalTotal')}
                keyboardType="decimal-pad"
                defaultValue={
                  settings.finalTotalOverride !== null ? String(settings.finalTotalOverride) : ''
                }
                onChangeText={(text) =>
                  patchSettings({
                    finalTotalOverride: text.trim() === '' ? null : parseMoneyInput(text),
                  })
                }
              />
              <Text className="-mt-2 text-xs text-muted-foreground">
                {t('offer.edit.finalTotalHint')}
              </Text>
              <TextField
                label={t('offer.edit.discountNote')}
                defaultValue={settings.discountNote ?? ''}
                onChangeText={(text) =>
                  patchSettings({ discountNote: text.trim() === '' ? null : text })
                }
              />

              <ToggleRow
                label={t('offer.edit.showDescriptions')}
                value={settings.showItemDescriptions}
                onChange={(v) => patchSettings({ showItemDescriptions: v })}
              />
              <ToggleRow
                label={t('offer.edit.keepConcept')}
                value={settings.isConcept}
                onChange={(v) => patchSettings({ isConcept: v })}
              />
            </Card>

            <Card className="gap-1.5 p-4">
              <SummaryRow label={t('offer.total.subtotal')} value={formatMoney(totals.subtotal)} />
              {totals.discount > 0 ? (
                <SummaryRow
                  label={t('offer.total.discount')}
                  value={`− ${formatMoney(totals.discount)}`}
                />
              ) : null}
              <SummaryRow label={t('offer.total.vat')} value={formatMoney(totals.vat)} />
              <SummaryRow label={t('offer.total.total')} value={formatMoney(totals.total)} strong />
            </Card>
          </ScrollView>

          <View className="border-t border-border/60 bg-background px-5 py-3">
            <Button
              title={save.isPending ? t('common.saving') : t('common.save')}
              loading={save.isPending}
              onPress={onSave}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

/**
 * One line.
 *
 * The text inputs are uncontrolled (`defaultValue`): a controlled numeric field
 * that reformats on every keystroke fights the keyboard — typing "1," becomes
 * "1" and the caret jumps. The parsed value flows up; the text stays the user's.
 */
function LineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: OfferLine;
  onChange: (patch: Partial<OfferLine>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const c = useColors();

  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <TextField
            label={t('offer.edit.name')}
            defaultValue={line.name}
            placeholder={t('offer.edit.newLine')}
            onChangeText={(text) => onChange({ name: text })}
          />
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('offer.edit.removeLine')}
          className="mt-7 h-10 w-10 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="trash-outline" size={20} color={c.destructive} />
        </Pressable>
      </View>

      <TextField
        label={t('offer.edit.note')}
        defaultValue={line.description ?? ''}
        multiline
        className="h-auto min-h-12 py-3"
        onChangeText={(text) => onChange({ description: text.trim() === '' ? null : text })}
      />

      <View className="flex-row gap-3">
        <TextField
          containerClassName="flex-1"
          label={t('offer.edit.quantity')}
          keyboardType="decimal-pad"
          defaultValue={String(line.quantity)}
          onChangeText={(text) => onChange({ quantity: parseMoneyInput(text) ?? 0 })}
        />
        <TextField
          containerClassName="flex-1"
          label={t('offer.edit.price')}
          keyboardType="decimal-pad"
          defaultValue={line.price ? String(line.price) : ''}
          onChangeText={(text) => onChange({ price: parseMoneyInput(text) ?? 0 })}
        />
        <TextField
          containerClassName="w-20"
          label={t('offer.edit.vatRate')}
          keyboardType="decimal-pad"
          defaultValue={String(line.vatRate)}
          onChangeText={(text) => onChange({ vatRate: parseMoneyInput(text) ?? 0 })}
        />
      </View>

      {line.pricePinned ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="lock-closed" size={14} color={c.mutedForeground} />
          <Text className="text-xs text-muted-foreground">{t('offer.price.pinned')}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function PriceCheckPanel({
  loading,
  lines,
  busy,
  onTake,
  onTogglePin,
}: {
  loading: boolean;
  lines: { itemId: number; name: string; price: number; listPrice: number | null; pinned: boolean }[];
  busy: boolean;
  onTake: (name: string, listPrice: number) => void;
  onTogglePin: (name: string, pinned: boolean, price: number) => void;
}) {
  const t = useT();
  const c = useColors();

  if (loading) {
    return (
      <Card className="items-center p-4">
        <ActivityIndicator color={c.mutedForeground} />
      </Card>
    );
  }

  const drifted = lines.filter((l) => l.listPrice !== null && l.listPrice !== l.price);

  if (drifted.length === 0) {
    return (
      <Card className="p-4">
        <Text className="text-sm text-muted-foreground">{t('offer.price.noDrift')}</Text>
      </Card>
    );
  }

  return (
    <Card className="gap-4 p-4">
      <Text className="text-xs text-muted-foreground">{t('offer.price.pinHint')}</Text>
      {drifted.map((line) => (
        <View key={line.itemId} className="gap-1.5">
          <Text className="text-sm text-foreground">{line.name}</Text>
          <Text className="text-xs text-muted-foreground">
            {t('offer.price.listSays', { price: formatMoney(line.listPrice as number) })}
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onTake(line.name, line.listPrice as number)}
              accessibilityRole="button"
              className="rounded-full bg-muted px-3 py-1.5 active:opacity-80"
            >
              <Text className="text-xs font-medium text-foreground">{t('offer.price.take')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onTogglePin(line.name, !line.pinned, line.price)}
              disabled={busy}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-full bg-muted px-3 py-1.5 active:opacity-80"
              style={busy ? { opacity: 0.5 } : undefined}
            >
              <Ionicons
                name={line.pinned ? 'lock-closed' : 'lock-open-outline'}
                size={13}
                color={c.foreground}
              />
              <Text className="text-xs font-medium text-foreground">
                {line.pinned ? t('offer.price.pinned') : t('offer.price.pin')}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </Card>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="flex-1 text-sm text-foreground">{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text
        className={`text-sm ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </Text>
      <Text className={`text-sm text-foreground ${strong ? 'font-bold' : ''}`}>{value}</Text>
    </View>
  );
}
