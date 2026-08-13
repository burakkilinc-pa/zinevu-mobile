import { useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { en, type MessageKey } from '@/lib/i18n/messages/en';
import { nl } from '@/lib/i18n/messages/nl';
import { de } from '@/lib/i18n/messages/de';
import { fr } from '@/lib/i18n/messages/fr';
import { tr } from '@/lib/i18n/messages/tr';

/**
 * App localization. The UI ships in the five languages the Zinevu portal itself
 * ships (see api.veranduo/lang and app.veranduo/messages): Dutch, English,
 * German, French and Turkish. On first launch the app follows the phone's language
 * (`system`), falling back to English when the device language isn't one we
 * support. The choice persists across launches and also drives the API
 * `Accept-Language` header so backend-sourced labels match the UI.
 *
 * Reactivity mirrors the theme store (src/lib/theme.ts): `useT()` subscribes to
 * the resolved locale, so switching language re-renders every screen. Code
 * outside React (api client, mappers) reads the non-reactive `t()` / helpers.
 */

export const SUPPORTED_LOCALES = ['nl', 'en', 'de', 'fr', 'tr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = 'system' | Locale;

const DICT: Record<Locale, Record<MessageKey, string>> = { nl, en, de, fr, tr };
const FALLBACK: Locale = 'en';
const STORAGE_KEY = 'zinevu.locale-preference';

/** Each language's own name — shown untranslated in the picker (endonyms). */
export const LOCALE_ENDONYM: Record<Locale, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  tr: 'Türkçe',
};

/**
 * BCP 47 tags for `Intl` / `toLocale*String` date + number formatting. English
 * maps to en-GB so dates read day-first like the other European locales.
 */
export const INTL_LOCALE: Record<Locale, string> = {
  nl: 'nl-NL',
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
  tr: 'tr-TR',
};

/** The Intl tag for the current language — for date/number formatting. */
export function currentIntlLocale(): string {
  return INTL_LOCALE[currentLocale()];
}

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * expo-localization is a native module. Loading it lazily (require inside a
 * try/catch, not a top-level import) means a build that doesn't yet bundle the
 * native side — e.g. an older dev build made before it was added — degrades to
 * the fallback language instead of crashing at startup with "Cannot find native
 * module 'ExpoLocalization'". Memoized so the require is attempted only once.
 */
let localization: typeof import('expo-localization') | null | undefined;
function getLocalization(): typeof import('expo-localization') | null {
  if (localization !== undefined) return localization;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    localization = require('expo-localization') as typeof import('expo-localization');
  } catch {
    localization = null;
  }
  return localization;
}

/** The first device language we support, or English. */
function deviceLocale(): Locale {
  const mod = getLocalization();
  if (!mod) return FALLBACK;
  try {
    for (const l of mod.getLocales()) {
      const code = l.languageCode?.toLowerCase();
      if (code && isLocale(code)) return code;
    }
  } catch {
    // native module present but the call failed → fall through
  }
  return FALLBACK;
}

export function resolveLocale(pref: LocalePreference): Locale {
  return pref === 'system' ? deviceLocale() : pref;
}

/** Substitutes `{name}` placeholders. */
function interpolate(
  str: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const table = DICT[locale] ?? DICT[FALLBACK];
  const str = table[key] ?? DICT[FALLBACK][key] ?? key;
  return interpolate(str, vars);
}

export type TFunction = (
  key: MessageKey,
  vars?: Record<string, string | number>
) => string;

type LocaleState = {
  /** What the user picked ('system' follows the device). */
  preference: LocalePreference;
  /** The concrete language currently rendered. */
  locale: Locale;
  hydrated: boolean;
  setPreference: (preference: LocalePreference) => void;
  hydrate: () => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  preference: 'system',
  locale: deviceLocale(),
  hydrated: false,
  setPreference: (preference) => {
    set({ preference, locale: resolveLocale(preference) });
    void AsyncStorage.setItem(STORAGE_KEY, preference);
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'system' || isLocale(stored))) {
        set({ preference: stored, locale: resolveLocale(stored) });
      }
    } catch {
      // no stored preference → keep the device default
    } finally {
      set({ hydrated: true });
    }
  },
}));

/** Applies the stored language once, at app start. */
export function useHydrateLocale(): void {
  const hydrate = useLocaleStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}

/** Reactive translator for components — re-renders when the language changes. */
export function useT(): TFunction {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale]
  );
}

/** The resolved language, for reactive component logic (labels, formatting). */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** Non-reactive read, for code outside a component (api client, mappers). */
export function currentLocale(): Locale {
  return useLocaleStore.getState().locale;
}

/** Non-reactive translate, for code outside a component. */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  return translate(currentLocale(), key, vars);
}

export type { MessageKey };
