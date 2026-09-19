import { useMemo } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { useT, useTFallback, type MessageKey } from '@/lib/i18n';
import { formatDecimal } from '@/features/form-analytics/format';
import {
  STEP_SUBMITTED,
  type VisitPlace,
  type VisitStatus,
} from '@/features/form-analytics/types';

/**
 * Turning the tracker's raw vocabulary back into words.
 *
 * Everything the API sends is the funnel's own naming — `front_side_2`,
 * `front_panel_type`, `sliding_glass_walls` — because the tracker records what
 * the form calls things, not what the visitor read. The web resolves those
 * against the 3D configurator's message files and every form's catalogue; the
 * app carries neither, so it names what it can and humanises the rest:
 *
 *  - step titles: the configurator sidebar's own words, copied into the
 *    catalogue (formAnalytics.step.*), in the narrower form the web uses for
 *    `structure` / `color` since those stopped being one screen each;
 *  - answers: the lead screens' existing field and value names (leads.answer.*,
 *    leads.value.*), which cover the common veranda questions;
 *  - anything else — a dealer-built form's steps, a panel type — as its key
 *    with the underscores taken out, so it still reads as words rather than
 *    "Step 3". Honest about being untranslated, and never blank.
 */

/** `front_side` → "Front side". */
export function humanizeKey(key: string): string {
  const s = key.replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/**
 * A step asked once per bay carries the bay number (`front_side_2`). Split it
 * off so the bay resolves to its question's title, just numbered.
 */
function splitStepKey(key: string): { base: string; number: number | null } {
  const m = /^(.*?)_(\d+)$/.exec(key);
  return m ? { base: m[1], number: Number(m[2]) } : { base: key, number: null };
}

/** Platform names as they are written — proper nouns, not translatable copy. */
const OS_LABEL: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
  chromeos: 'ChromeOS',
  linux: 'Linux',
};

const DEVICE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  mobile: 'phone-portrait-outline',
  tablet: 'tablet-portrait-outline',
  desktop: 'desktop-outline',
};

export function deviceIcon(deviceType: string | null): keyof typeof Ionicons.glyphMap {
  return DEVICE_ICON[deviceType ?? ''] ?? 'globe-outline';
}

/**
 * Configurator fields whose events, until 2026-08-07, carried a catalogue
 * POSITION instead of the option's name. Those old answers keep their question
 * and lose their value — "Front: 1" would read as something the visitor chose.
 */
const POSITIONAL_FIELDS = new Set([
  'roof_type',
  'front_panel_type',
  'right_panel_type',
  'left_panel_type',
  'back_panel_type',
  'front_glass_type',
  'right_glass_type',
  'left_glass_type',
  'back_glass_type',
  'front_fabric_color',
  'sunshade_fabric_color',
  'profile_color',
  'light_color',
  'light_system',
  'right_wedge_type',
  'left_wedge_type',
  'sunshade',
  'sunshade_position',
  'budget',
]);

export function useAnalyticsVocabulary() {
  const t = useT();
  const tf = useTFallback();

  return useMemo(() => {
    /** "Veranda", "Carport" — the product, not the rendering. */
    const formType = (type: string | null): string | null =>
      type ? tf(`leads.formType.${type}`, humanizeKey(type)) : null;

    /**
     * A step's title. `index` is only a fallback for visits recorded before
     * step keys existed, and reads "Step n".
     */
    const step = (key: string | null, index?: number | null): string | null => {
      if (!key) return typeof index === 'number' ? t('formAnalytics.step.unnamed', { n: index + 1 }) : null;
      // The closing bar is the outcome, not a question — no form names it.
      if (key === STEP_SUBMITTED) return t('formAnalytics.funnel.submitted');

      const whole = tf(`formAnalytics.step.${key}`, '');
      if (whole) return whole;

      const { base, number } = splitStepKey(key);
      const title = tf(`formAnalytics.step.${base}`, humanizeKey(base));

      return number === null ? title : t('formAnalytics.step.numbered', { title, n: number });
    };

    const event = (name: string): string => tf(`formAnalytics.event.${name}`, humanizeKey(name));

    const status = (value: VisitStatus): string => t(`formAnalytics.status.${value}` as MessageKey);

    /** "Mobile · iOS" — the bucket plus the platform, when the API could tell. */
    const device = (type: string | null, os?: string | null): string => {
      const bucket = type
        ? tf(`formAnalytics.device.${type}`, humanizeKey(type))
        : t('formAnalytics.device.unknown');
      const platform = os ? OS_LABEL[os] : undefined;

      return platform ? `${bucket} · ${platform}` : bucket;
    };

    /** `direct` is ours to name; anything else is a host or a utm tag, as sent. */
    const source = (value: string): string =>
      value === 'direct' ? t('formAnalytics.sources.direct') : value;

    const surface = (value: string): string =>
      t(value === '3d' ? 'formAnalytics.surface.3d' : 'formAnalytics.surface.flat');

    /**
     * "Hardinxveld-Giessendam, NL". The city is what a dealer reads (is this ad
     * reaching my region?), so the country stays a code, and the region only
     * stands in when there is no city at all.
     */
    const place = (value: VisitPlace): string => {
      const parts = [value.city, value.countryCode].filter(Boolean);
      if (parts.length) return parts.join(', ');

      return value.region ?? t('formAnalytics.visits.unknownPlace');
    };

    /** One answer in full — "Front: Sliding glass walls" — or null without a field. */
    const option = (
      field: string | null,
      value: string | number | boolean | null
    ): string | null => {
      if (!field) return null;

      // Not a question: the funnels journal their own buttons under `cta`.
      if (field === 'cta') {
        const label = t('formAnalytics.cta.field');
        return typeof value === 'string' && value
          ? `${label}: ${tf(`formAnalytics.cta.${value}`, humanizeKey(value))}`
          : label;
      }

      const label = tf(`leads.answer.${field}`, humanizeKey(field));
      let answer: string | null = null;
      if (typeof value === 'boolean') {
        answer = t(value ? 'formAnalytics.yes' : 'formAnalytics.no');
      } else if (typeof value === 'number') {
        answer = POSITIONAL_FIELDS.has(field) ? null : formatDecimal(value);
      } else if (typeof value === 'string' && value) {
        answer = tf(`leads.value.${value}`, humanizeKey(value));
      }

      return answer ? `${label}: ${answer}` : label;
    };

    return { formType, step, event, status, device, source, surface, place, option };
  }, [t, tf]);
}

export type AnalyticsVocabulary = ReturnType<typeof useAnalyticsVocabulary>;
