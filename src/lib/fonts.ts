import { StyleSheet, Text, TextInput } from 'react-native';
// One weight per import path: the packages' root index requires every weight
// they ship (25 files), and Metro bundles whatever is required.
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';

/**
 * Typography, matched to zinevu.com: DM Sans for everything you read, and
 * Bricolage Grotesque for display — the site's headings (`--font-display`).
 * The dealer portal moved to the same pair on 2026-09-13.
 *
 * React Native has no font inheritance and this app sets no font classes, so
 * every Text would render in the OS system font. We load the faces and patch
 * Text/TextInput to default to them — picking the right *named* weight face
 * (RN can't synthesise weights reliably across iOS/Android from a single
 * face), while leaving any explicit fontFamily (e.g. icon fonts) alone.
 *
 * Display is decided the way the site decides it, by role rather than by a
 * class on every title: semibold text at 18pt and up is a heading, and headings
 * are Bricolage. Body copy never reaches that size, so nothing else moves.
 */
export const fontMap = {
  DMSans: DMSans_400Regular,
  'DMSans-Medium': DMSans_500Medium,
  'DMSans-SemiBold': DMSans_600SemiBold,
  'DMSans-Bold': DMSans_700Bold,
  'Bricolage-SemiBold': BricolageGrotesque_600SemiBold,
  'Bricolage-Bold': BricolageGrotesque_700Bold,
};

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'DMSans',
  '200': 'DMSans',
  '300': 'DMSans',
  '400': 'DMSans',
  normal: 'DMSans',
  '500': 'DMSans-Medium',
  '600': 'DMSans-SemiBold',
  '700': 'DMSans-Bold',
  '800': 'DMSans-Bold',
  '900': 'DMSans-Bold',
  bold: 'DMSans-Bold',
};

/** From this size up, a semibold-or-heavier line is a heading. */
const DISPLAY_MIN_SIZE = 18;

function displayFamily(weight: string): string | null {
  if (weight === '600') return 'Bricolage-SemiBold';
  if (['700', '800', '900', 'bold'].includes(weight)) return 'Bricolage-Bold';
  return null;
}

function patchDefaultFont(Component: any, allowDisplay: boolean): void {
  const original = Component?.render;
  if (typeof original !== 'function' || original.__zinevuFontPatched) return;

  const patched = function (this: any, props: any, ref: any) {
    const flat = StyleSheet.flatten(props?.style) || {};
    // Respect an explicit family (icon fonts, deliberate overrides).
    if (flat.fontFamily) return original.call(this, props, ref);
    const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
    const display =
      allowDisplay && typeof flat.fontSize === 'number' && flat.fontSize >= DISPLAY_MIN_SIZE
        ? displayFamily(weight)
        : null;
    const fontFamily = display ?? FAMILY_BY_WEIGHT[weight] ?? 'DMSans';
    // Family already encodes the weight — clear fontWeight so iOS doesn't also
    // try to synthesise on top of it.
    const style = [{ fontFamily }, props?.style, { fontWeight: undefined }];
    return original.call(this, { ...props, style }, ref);
  };
  patched.__zinevuFontPatched = true;
  Component.render = patched;
}

/** Run once at startup (side-effect import in the root layout). */
export function installDefaultFont(): void {
  patchDefaultFont(Text, true);
  // What somebody types is never a heading.
  patchDefaultFont(TextInput, false);
}
