import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { currentIntlLocale, useLocale, useT, type MessageKey, type TFunction } from '@/lib/i18n';
import { useActiveForms } from '@/features/leads/hooks/use-leads';
import type { ActiveForm } from '@/features/leads/api/leads.api';
import {
  canMeasure,
  measureForLead,
  withMeasuredSize,
  type MeasuredSize,
} from '@/features/ar-measure/ar-measure';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

/**
 * The form catalogue, in the portal's own order (see `views/forms/formCatalog`
 * on the web side) — so a dealer who knows their list from the browser finds it
 * in the same order here.
 *
 * A type absent from this list is one that shipped after this build: it is still
 * offered, just last and under its own slug, because a funnel the dealer has
 * switched on must never be missing from this sheet.
 */
const FORM_CATALOG: { formType: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { formType: 'veranda', icon: 'home-outline' },
  { formType: 'cube_veranda', icon: 'cube-outline' },
  { formType: 'carport', icon: 'car-outline' },
  { formType: 'veranda_sunshade', icon: 'umbrella-outline' },
  { formType: 'sliding_doors', icon: 'albums-outline' },
];

const CATALOG_ORDER = FORM_CATALOG.map((entry) => entry.formType);

function formTypeIcon(formType: string): keyof typeof Ionicons.glyphMap {
  return FORM_CATALOG.find((entry) => entry.formType === formType)?.icon ?? 'grid-outline';
}

function formTypeLabel(formType: string, t: TFunction): string {
  if (CATALOG_ORDER.includes(formType)) {
    return t(`leads.formType.${formType}` as MessageKey);
  }

  return formType.charAt(0).toUpperCase() + formType.slice(1).replace(/_/g, ' ');
}

/**
 * The funnels a measured width × depth means something to: a roof on posts
 * against the house. Sliding walls take a width but no depth, and a type this
 * build does not know could be anything — neither is offered after measuring.
 */
const MEASURABLE_TYPES = ['veranda', 'cube_veranda', 'veranda_sunshade', 'carport'];

function metres(cm: number): string {
  try {
    return new Intl.NumberFormat(currentIntlLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cm / 100);
  } catch {
    return (cm / 100).toFixed(2);
  }
}

/** Catalogue order first, unknown types after it, `quick` under its own full form. */
function catalogRank(formType: string): number {
  const i = CATALOG_ORDER.indexOf(formType);

  return i === -1 ? CATALOG_ORDER.length : i;
}

/**
 * "New lead": a big target, and then the dealer's own funnels.
 *
 * Big because it is the one thing on this screen you press without looking —
 * standing in someone's garden, phone in one hand. It floats above the list at
 * the thumb's natural resting place rather than living in a header.
 *
 * What it opens is the real configurator, in a WebView. That is the whole point:
 * a lead created on a phone goes through the same questions, the same pricing
 * and the same renders a customer would see, so there is no second creation
 * path that could quietly disagree with the first.
 *
 * When exactly one funnel is live it skips the sheet and opens it — a menu with
 * one item is a tap wasted.
 *
 * The funnels sit behind their own capability, and a customer-service seat has
 * the leads list without it. On the web that seat still gets the manual entry
 * form; there is no such form on a phone, so here the button simply isn't there
 * rather than opening a sheet that can only ever be empty.
 *
 * On an iPhone that can do AR the sheet opens with "measure first": the App
 * Clip's measuring flow, then a second sheet asking which veranda, and that
 * funnel opens with the measured width and depth already answered (the
 * funnel's `zv_*` seed contract — see `withMeasuredSize`). It is also where
 * the app carries every App Clip feature, which App Review requires
 * (Guideline 2.5.16).
 */
export function NewLeadButton() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const canSeeForms = hasPermission(user, PERMISSIONS.formsView);
  const forms = useActiveForms(canSeeForms);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Asked once: the hardware does not change under a mounted screen.
  const [measurable] = useState(canMeasure);
  // The size just measured, and whether the "which veranda?" sheet is up. Two
  // states so the size stays readable while that sheet animates away.
  const [size, setSize] = useState<MeasuredSize | null>(null);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  // Work that must wait until the first sheet is fully gone — see onDismissed.
  const afterSheet = useRef<(() => void) | null>(null);

  const available = useMemo(
    () =>
      [...(forms.data ?? [])].sort(
        (a, b) =>
          catalogRank(a.formType) - catalogRank(b.formType) ||
          Number(a.quick) - Number(b.quick)
      ),
    [forms.data]
  );

  const measurableForms = useMemo(
    () => available.filter((form) => MEASURABLE_TYPES.includes(form.formType)),
    [available]
  );
  const offerMeasure = measurable && measurableForms.length > 0;

  function open(url: string) {
    setSheetOpen(false);
    setTypeSheetOpen(false);
    router.push({ pathname: '/web-3d', params: { url } });
  }

  function press() {
    if (!offerMeasure && available.length === 1) {
      open(available[0].url);
      return;
    }
    setSheetOpen(true);
  }

  function measureFirst() {
    // Not straight away: the measuring flow is a native full-screen modal, and
    // presented over a sheet that is still closing it would be torn down with
    // it. The sheet's onDismissed runs this once it is gone.
    afterSheet.current = () => void measure();
    setSheetOpen(false);
  }

  async function measure() {
    const measured = await measureForLead(locale);
    if (!measured) return;
    if (measurableForms.length === 1) {
      open(withMeasuredSize(measurableForms[0].url, measured));
      return;
    }
    setSize(measured);
    setTypeSheetOpen(true);
  }

  function formRow(form: ActiveForm, onPress: () => void) {
    return (
      <Pressable
        key={form.id}
        onPress={onPress}
        accessibilityRole="button"
        className="flex-row items-center gap-3 rounded-xl px-1 py-3.5 active:bg-muted"
      >
        <Ionicons
          name={form.quick ? 'flash-outline' : formTypeIcon(form.formType)}
          size={20}
          color={c.foreground}
        />
        <View className="flex-1">
          <Text className="text-base text-foreground">{formTypeLabel(form.formType, t)}</Text>
          <Text className="text-xs text-muted-foreground">
            {form.quick ? t('leads.new.quick') : t('leads.new.full')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
      </Pressable>
    );
  }

  if (!canSeeForms) return null;

  return (
    <>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={t('leads.new.action')}
        className="absolute right-5 flex-row items-center gap-2 rounded-full px-5 py-4 active:opacity-90"
        style={{
          // Clears the floating dock (~62pt + margin) so the two never overlap.
          bottom: insets.bottom + 86,
          backgroundColor: c.primary,
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={22} color={c.background} />
        <Text className="text-base font-semibold" style={{ color: c.background }}>
          {t('leads.new.action')}
        </Text>
      </Pressable>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDismissed={() => {
          const next = afterSheet.current;
          afterSheet.current = null;
          next?.();
        }}
      >
        <View className="gap-1">
            <Text className="mb-3 mt-4 text-lg font-bold text-foreground">
              {t('leads.new.title')}
            </Text>

            {offerMeasure ? (
              <Pressable
                onPress={measureFirst}
                accessibilityRole="button"
                className="mb-2 flex-row items-center gap-3 rounded-2xl border border-border px-3 py-3.5 active:bg-muted"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.primary }}
                >
                  <Ionicons name="scan" size={19} color={c.background} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">
                    {t('leads.new.measure')}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('leads.new.measureHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
              </Pressable>
            ) : null}

            {available.length === 0 ? (
              <Text className="pb-4 text-sm text-muted-foreground">
                {forms.isLoading ? t('common.loading') : t('leads.new.noForms')}
              </Text>
            ) : (
              available.map((form) => formRow(form, () => open(form.url)))
            )}
        </View>
      </BottomSheet>

      <BottomSheet visible={typeSheetOpen} onClose={() => setTypeSheetOpen(false)}>
        <View className="gap-1">
          <Text className="mt-4 text-lg font-bold text-foreground">{t('leads.new.pickType')}</Text>
          {size ? (
            <Text className="mb-3 text-sm text-muted-foreground">
              {t('leads.new.measured', {
                width: metres(size.widthCm),
                depth: metres(size.depthCm),
              })}
            </Text>
          ) : null}
          {size
            ? measurableForms.map((form) =>
                formRow(form, () => open(withMeasuredSize(form.url, size)))
              )
            : null}
        </View>
      </BottomSheet>
    </>
  );
}
