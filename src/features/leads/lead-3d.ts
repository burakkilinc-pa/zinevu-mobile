import type { DealerForm } from '@/features/leads/api/leads.api';
import type { LeadDetail } from '@/features/leads/api/lead-detail.api';

/**
 * Opening an existing lead in the 3D configurator.
 *
 * The portal has no URL that addresses a lead in 3D — deliberately: no lead id
 * ever appears in the address bar. Instead the lead page stashes a handoff blob
 * in `sessionStorage` under `lead3d:in` and navigates to `/configure/3d?edit=lead`,
 * where `LeadEditMount` reads it back. See
 * `app.veranduo/src/features/configurator-3d/LeadEditMount.tsx`.
 *
 * The phone does the same thing, one step more manually: it builds the same blob
 * and injects it into the WebView before the page loads. Keeping the web's
 * contract rather than inventing a mobile-only route means a lead looks the same
 * in 3D on both, and the scene stays gated on the dealer's own option overrides.
 *
 * This is a viewer. Nothing here saves: the mobile app never sets a return
 * href, so the configurator's save affordance leads nowhere useful and the
 * dealer edits answers on the answers screen instead.
 */

/** The sessionStorage key `LeadEditMount` reads its handoff from. */
export const LEAD_3D_IN_KEY = 'lead3d:in';

export type Lead3dTarget = { url: string; handoff: string };

/**
 * The configurator's own origin, taken from a funnel link.
 *
 * A dealer with a verified custom domain serves their funnels from it, so the
 * host is not a constant the app can hold — the API is the only thing that
 * knows, and it already says so on every form.
 */
function configuratorUrl(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    // Funnel links are locale-prefixed (`/nl/q/{slug}`), and so is the
    // configurator route. Reusing the funnel's locale keeps the 3D chrome in
    // the language the dealer's own site is served in.
    const locale = parsed.pathname.split('/').filter(Boolean)[0];
    const prefix = locale && /^[a-z]{2}$/.test(locale) ? `/${locale}` : '';

    return `${parsed.origin}${prefix}/configure/3d?edit=lead`;
  } catch {
    return null;
  }
}

/**
 * Where to send the WebView for this lead, and what to put in front of it.
 *
 * Null when the dealer has no funnel with a link — without one there is no host
 * to load the configurator from, and the button that calls this is hidden.
 */
export function lead3dTarget(lead: LeadDetail, form: DealerForm | null): Lead3dTarget | null {
  const publicUrl = form?.publicUrl ?? form?.quickPublicUrl ?? null;
  const url = publicUrl ? configuratorUrl(publicUrl) : null;

  if (!url) return null;

  return {
    url,
    handoff: JSON.stringify({
      masterBase: lead.answerMap,
      ref: lead.ref,
      formType: lead.formType,
      optionOverrides: form?.optionOverrides ?? {},
      slug: form?.slug ?? null,
      // Required — `LeadEditMount` treats a blank one as an expired handoff and
      // bounces straight back out. It is never navigated to here: leaving is
      // the header's Back, which pops the native screen.
      backHref: '/portal/dealer/leads',
    }),
  };
}
