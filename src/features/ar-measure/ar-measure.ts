import { requireOptionalNativeModule } from 'expo';

/**
 * The veranda measurement the App Clip runs, opened from inside this app.
 *
 * iOS only. It is the clip's own ARKit + RealityKit Swift (modules/ar-measure),
 * and Android builds carry no native half at all — so the module is optional
 * and everything here degrades to "not offered" rather than throwing.
 */
type ArMeasureNative = {
  isSupported(): boolean;
  present(url: string | null, language: string): Promise<boolean>;
  measure(language: string): Promise<MeasuredSize | null>;
};

/** What a measurement for a new lead comes back as — the size on the screen. */
export type MeasuredSize = { widthCm: number; depthCm: number; clamped: boolean };

const native = requireOptionalNativeModule<ArMeasureNative>('ArMeasure');

/** Whether to offer measuring at all: an iPhone with world tracking. */
export function canMeasure(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/**
 * Open the measuring flow full-screen for an App Clip invocation URL: the
 * measurement is written into that visitor's design — the same thing the clip
 * would have done, had iOS not opened this app instead.
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

/**
 * Measure first, for a new lead. Resolves with the size once the dealer taps
 * "continue with these sizes", or null when they close the flow. The modal is
 * already gone when it resolves.
 */
export async function measureForLead(language: string): Promise<MeasuredSize | null> {
  if (!native) return null;
  const size = await native.measure(language);
  if (!size || !(size.widthCm > 0) || !(size.depthCm > 0)) return null;
  return size;
}

/**
 * A public form address, carrying a measured size as answers.
 *
 * `zv_width` / `zv_depth` (cm) are the funnel's own seed contract
 * (app.veranduo `src/lib/formSeedParams.js`): resolved on the server into the
 * form's width and depth, clamped into what that dealer sells, never an error.
 * No `zv_step` — the form starts at its first question as always, and the size
 * is simply already there when the dealer reaches it.
 */
export function withMeasuredSize(url: string, size: MeasuredSize): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('zv_width', String(Math.round(size.widthCm)));
    parsed.searchParams.set('zv_depth', String(Math.round(size.depthCm)));
    return parsed.toString();
  } catch {
    return url;
  }
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
