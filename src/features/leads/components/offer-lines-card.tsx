import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { computeTotals } from '@/features/leads/offer-totals';
import type { OfferLine, OfferSettings } from '@/features/leads/api/offer.api';

/**
 * The offer, as it stands.
 *
 * Totals are recomputed here rather than read from `deal.total` so this card
 * and the editor never disagree by a cent — both run the same port of the
 * backend's formula, on the same lines.
 */
export function OfferLinesCard({
  lines,
  settings,
  canSeePrices,
  onEdit,
}: {
  lines: OfferLine[];
  settings: OfferSettings;
  /** Crew roles get the lines without the money — the API strips it too. */
  canSeePrices: boolean;
  onEdit?: () => void;
}) {
  const t = useT();
  const c = useColors();

  const totals = computeTotals(
    lines.map((l) => ({ quantity: l.quantity, price: l.price, vatRate: l.vatRate })),
    settings.discountRate,
    settings.finalTotalOverride
  );

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-foreground">{t('offer.section.title')}</Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            accessibilityRole="button"
            className="flex-row items-center gap-1 rounded-full px-2 py-1 active:bg-muted"
          >
            <Ionicons name="create-outline" size={16} color={c.foreground} />
            <Text className="text-sm font-medium text-foreground">{t('offer.edit.open')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Card className="gap-3 p-4">
        {lines.length === 0 ? (
          <Text className="text-sm text-muted-foreground">{t('offer.section.empty')}</Text>
        ) : (
          lines.map((line, index) => (
            <View key={line.id ?? line.clientKey ?? `row-${index}`} className="gap-0.5">
              <View className="flex-row items-start justify-between gap-4">
                <Text className="flex-1 text-sm text-foreground">{line.name}</Text>
                {canSeePrices ? (
                  <Text className="text-sm font-medium text-foreground">
                    {formatMoney(line.quantity * line.price)}
                  </Text>
                ) : null}
              </View>
              {canSeePrices && line.quantity !== 1 ? (
                <Text className="text-xs text-muted-foreground">
                  {t('offer.total.perPiece', {
                    qty: String(line.quantity),
                    price: formatMoney(line.price),
                  })}
                </Text>
              ) : null}
            </View>
          ))
        )}

        {canSeePrices && lines.length > 0 ? (
          <View className="gap-1.5 border-t border-border/60 pt-3">
            <TotalRow label={t('offer.total.subtotal')} value={formatMoney(totals.subtotal)} />
            {totals.discount > 0 ? (
              <TotalRow
                label={settings.discountNote || t('offer.total.discount')}
                value={`− ${formatMoney(totals.discount)}`}
              />
            ) : null}
            <TotalRow label={t('offer.total.vat')} value={formatMoney(totals.vat)} />
            <TotalRow label={t('offer.total.total')} value={formatMoney(totals.total)} strong />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text
        className={`text-sm ${strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
      >
        {label}
      </Text>
      <Text className={`text-sm text-foreground ${strong ? 'font-bold' : ''}`}>{value}</Text>
    </View>
  );
}
