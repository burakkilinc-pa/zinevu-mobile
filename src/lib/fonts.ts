import { StyleSheet, Text, TextInput } from 'react-native';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';

/**
 * Typography, matched to the Zinevu dealer portal, which sets Sora as its only
 * `sans` family (app.veranduo/tailwind.config.mjs).
 *
 * React Native has no font inheritance and this app sets no font classes, so
 * every Text would render in the OS system font. We load Sora in four weights
 * and patch Text/TextInput to default to it — picking the right *named* weight
 * face (RN can't synthesise weights reliably across iOS/Android from a single
 * face), while leaving any explicit fontFamily (e.g. icon fonts) alone.
 */
export const fontMap = {
  Sora: Sora_400Regular,
  'Sora-Medium': Sora_500Medium,
  'Sora-SemiBold': Sora_600SemiBold,
  'Sora-Bold': Sora_700Bold,
};

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'Sora',
  '200': 'Sora',
  '300': 'Sora',
  '400': 'Sora',
  normal: 'Sora',
  '500': 'Sora-Medium',
  '600': 'Sora-SemiBold',
  '700': 'Sora-Bold',
  '800': 'Sora-Bold',
  '900': 'Sora-Bold',
  bold: 'Sora-Bold',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function patchDefaultFont(Component: any): void {
  const original = Component?.render;
  if (typeof original !== 'function' || original.__zinevuFontPatched) return;

  const patched = function (this: any, props: any, ref: any) {
    const flat = StyleSheet.flatten(props?.style) || {};
    // Respect an explicit family (icon fonts, deliberate overrides).
    if (flat.fontFamily) return original.call(this, props, ref);
    const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
    const fontFamily = FAMILY_BY_WEIGHT[weight] ?? 'Sora';
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
  patchDefaultFont(Text);
  patchDefaultFont(TextInput);
}
