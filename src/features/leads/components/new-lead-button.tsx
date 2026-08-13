import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { useActiveForms } from '@/features/leads/hooks/use-leads';
import type { TFunction } from '@/lib/i18n';

/** Form types the app has a word for. Anything else is a type that shipped
 *  after this build — show its own name rather than a missing translation key. */
const KNOWN_FORM_TYPES = ['veranda', 'carport'];

function formTypeLabel(formType: string, t: TFunction): string {
  if (KNOWN_FORM_TYPES.includes(formType)) {
    return t(`leads.formType.${formType}` as MessageKey);
  }

  return formType.charAt(0).toUpperCase() + formType.slice(1).replace(/_/g, ' ');
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
 */
export function NewLeadButton() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const forms = useActiveForms();
  const [sheetOpen, setSheetOpen] = useState(false);

  const available = forms.data ?? [];

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

      <Modal
        visible={sheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => setSheetOpen(false)}
        >
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable
            onPress={() => {}}
            className="gap-1 rounded-t-3xl bg-card px-5 pt-5"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <Text className="mb-3 text-lg font-bold text-foreground">
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
                    name={form.quick ? 'flash-outline' : 'cube-outline'}
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
