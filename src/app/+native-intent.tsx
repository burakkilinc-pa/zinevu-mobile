import { currentLocale } from '@/lib/i18n';
import {
  holdMeasureInvocation,
  measureInvocationUrl,
  openMeasure,
} from '@/features/ar-measure/ar-measure';

/**
 * Every URL the system hands the app passes through here before the router
 * sees it.
 *
 * One kind must never reach the router: an App Clip invocation,
 * `https://app.zinevu.com/ar/{slug}?id=…`. Once this app is installed iOS opens
 * IT instead of the measuring clip, and there is no `/ar` route — the dealer
 * who scanned a customer's QR would land on "page not found" with the design
 * lost. It goes to the clip's own measuring flow instead, compiled into the app
 * (modules/ar-measure), and writes into that customer's design as the clip
 * would have.
 *
 * `path` is the full URL, not just its path, on a cold start and at runtime
 * alike (expo-router's getLinkingConfig / linking.subscribe).
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  // Two doors, one destination: the https address a QR or an App Clip
  // invocation carries, and `zinevumobile://ar?u=…`, which the /ar page offers
  // because a browser without a Smart App Banner has no other way in.
  const invocation = measureInvocationUrl(path);
  if (!invocation) return path;

  if (initial) {
    // Nothing is on screen yet to present over; the root layout releases it
    // once the splash is gone. Meanwhile start where a normal launch starts.
    holdMeasureInvocation(invocation);
    return '/';
  }

  // Already running: present now and leave the current screen where it is.
  void openMeasure({ url: invocation, language: currentLocale() });
  return null;
}
