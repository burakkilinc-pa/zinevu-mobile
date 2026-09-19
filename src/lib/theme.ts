import { useEffect } from 'react';
import { colorScheme as nativewindColorScheme, useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

/**
 * Hex mirrors of the semantic tokens in global.css. NativeWind resolves the
 * `bg-*` / `text-*` classes itself; these exist for the props that only take a
 * raw color (icon `color`, `placeholderTextColor`, navigator options) so both
 * paths flip together when the scheme changes.
 */
export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  /** What to write ON the primary face — black on lime, in both schemes. */
  primaryForeground: string;
  /** The brand's structure colour: black edges, the pressed face of a button. */
  ink: string;
  /** What to write on an `ink` face — white on black (never lime). */
  onInk: string;
  /** Deep teal — the brand's dark surface, never body text. */
  deep: string;
  destructive: string;
  warning: string;
  success: string;
  white: string;
};

const LIGHT: ThemeColors = {
  background: '#F7F4ED',
  foreground: '#000000',
  card: '#FFFFFF',
  muted: '#EFEBE1',
  mutedForeground: '#5B6566',
  border: '#D4D2CC',
  primary: '#E7FFA4',
  primaryForeground: '#000000',
  ink: '#000000',
  onInk: '#FFFFFF',
  deep: '#082D36',
  destructive: '#B91C1C',
  warning: '#B45309',
  success: '#16A34A',
  white: '#FFFFFF',
} as const;

const DARK: ThemeColors = {
  background: '#04191F',
  foreground: '#F6F7F9',
  card: '#0B2C35',
  muted: '#123138',
  mutedForeground: '#9AAFB5',
  border: '#1F444E',
  primary: '#E7FFA4',
  primaryForeground: '#000000',
  // Black edges vanish on a dark ground; the edge colour becomes paper.
  ink: '#F7F4ED',
  onInk: '#000000',
  deep: '#082D36',
  destructive: '#B93030',
  warning: '#EFB13A',
  success: '#34C759',
  white: '#FFFFFF',
} as const;

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'zinevu.theme-preference';

/** Colors for the scheme currently rendered. */
export function useColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}

/** Non-reactive read, for code outside a component. */
export function currentColors(): ThemeColors {
  return nativewindColorScheme.get() === 'dark' ? DARK : LIGHT;
}

type ThemeState = {
  preference: ThemePreference;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  hydrate: () => Promise<void>;
};

/** The user's light/dark choice, persisted across launches. */
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  hydrated: false,
  setPreference: (preference) => {
    set({ preference });
    nativewindColorScheme.set(preference);
    void AsyncStorage.setItem(STORAGE_KEY, preference);
  },
  hydrate: async () => {
    try {
      const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as
        | ThemePreference
        | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored });
        nativewindColorScheme.set(stored);
      }
    } catch {
      // a missing preference just means "system"
    } finally {
      set({ hydrated: true });
    }
  },
}));

/** Applies the stored preference once, at app start. */
export function useHydrateTheme(): void {
  const hydrate = useThemeStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
