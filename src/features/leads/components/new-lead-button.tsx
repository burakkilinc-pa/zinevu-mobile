import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { useActiveForms } from '@/features/leads/hooks/use-leads';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import type { TFunction } from '@/lib/i18n';

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
 */
export function NewLeadButton() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const canSeeForms = hasPermission(user, PERMISSIONS.formsView);
  const forms = useActiveForms(canSeeForms);
  const [sheetOpen, setSheetOpen] = useState(false);

  const available = useMemo(
    () =>
      [...(forms.data ?? [])].sort(
        (a, b) =>
          catalogRank(a.formType) - catalogRank(b.formType) ||
          Number(a.quick) - Number(b.quick)
      ),
    [forms.data]
  );

  function open(url: string) {
    setSheetOpen(false);
    router.push({ pathname: '/web-3d', params: { url } });
  }

  function press() {
    if (available.length === 1) {
      open(available[0].url);
      return;
    }
    setSheetOpen(true);
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

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View className="gap-1">
            <Text className="mb-3 mt-4 text-lg font-bold text-foreground">
              {t('leads.new.title')}
            </Text>

            {available.length === 0 ? (
              <Text className="pb-4 text-sm text-muted-foreground">
                {forms.isLoading ? t('common.loading') : t('leads.new.noForms')}
              </Text>
            ) : (
              available.map((form) => (
                <Pressable
                  key={form.id}
                  onPress={() => open(form.url)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-3 rounded-xl px-1 py-3.5 active:bg-muted"
                >
                  <Ionicons
                    name={form.quick ? 'flash-outline' : formTypeIcon(form.formType)}
                    size={20}
                    color={c.foreground}
                  />
                  <View className="flex-1">
                    <Text className="text-base text-foreground">
                      {formTypeLabel(form.formType, t)}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {form.quick ? t('leads.new.quick') : t('leads.new.full')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
                </Pressable>
              ))
            )}
        </View>
      </BottomSheet>
    </>
  );
}
