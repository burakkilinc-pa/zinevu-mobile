import { requireOptionalNativeModule } from 'expo';

/**
 * The terrace measurement the App Clip runs, opened from inside this app.
 *
 * iOS only. It is the clip's own ARKit + RealityKit Swift (modules/ar-measure),
 * and Android builds carry no native half at all — so the module is optional
 * and everything here degrades to "not offered" rather than throwing.
 */
type ArMeasureNative = {
  isSupported(): boolean;
  present(url: string | null, language: string): Promise<boolean>;
};

const native = requireOptionalNativeModule<ArMeasureNative>('ArMeasure');

/** Whether to show a measure button at all: an iPhone with world tracking. */
export function canMeasure(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/**
 * Open the measuring flow full-screen.
 *
 * With no `url` a dealer is measuring on-site and the result stays on screen.
 * With an App Clip invocation URL the measurement is written into that
 * visitor's design — the same thing the clip would have done, had iOS not
 * opened this app instead.
 */
export async function openMeasure({
  url,
  language,
}: {
  url?: string | null;
  language: string;
}): Promise<boolean> {
  if (!native) return false;
  return native.present(url ?? null, language);
}

/** `https://app.zinevu.com/ar/…` — the one URL shape the clip answers to. */
export function isMeasureInvocation(url: string): boolean {
  return /^https:\/\/app\.zinevu\.com\/ar(?:[/?#]|$)/i.test(url);
}

/**
 * An invocation that arrived before there was anything to present over.
 *
 * On a cold start the URL is read while the router is still being built and
 * the animated splash has yet to run, so it is parked here and released by the
 * root layout once the splash is gone (see `_layout.tsx`). A URL that arrives
 * while the app is already open needs none of this.
 */
let pendingInvocation: string | null = null;

export function holdMeasureInvocation(url: string): void {
  pendingInvocation = url;
}

export function releaseHeldMeasure(language: string): void {
  const url = pendingInvocation;
  pendingInvocation = null;
  if (url) void openMeasure({ url, language });
}
