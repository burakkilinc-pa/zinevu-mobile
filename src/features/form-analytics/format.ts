import { currentIntlLocale, type TFunction } from '@/lib/i18n';
import type { Visit, VisitStatus } from '@/features/form-analytics/types';

/**
 * Numbers on the analytics screens, in the language the dealer is reading:
 * "1.234" in Dutch, "1 234" in French, "%3,4" in Turkish. The API sends plain
 * numbers and already-rounded percentages; all localisation happens here.
 *
 * Formatters are cached per locale — a busy screen formats a few hundred
 * figures a render, and building an Intl.NumberFormat is not free on Hermes.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(kind: 'count' | 'decimal' | 'percent'): Intl.NumberFormat {
  const locale = currentIntlLocale();
  const id = `${locale}|${kind}`;
  let f = formatters.get(id);
  if (!f) {
    f = new Intl.NumberFormat(
      locale,
      kind === 'count'
        ? { maximumFractionDigits: 0 }
        : kind === 'decimal'
          ? { maximumFractionDigits: 1 }
          : { style: 'percent', maximumFractionDigits: 1 }
    );
    formatters.set(id, f);
  }
  return f;
}

/** A whole count — visits, requests, people. */
export function formatCount(n: number): string {
  try {
    return formatter('count').format(n);
  } catch {
    // A locale Intl can't load must not take the screen down with it.
    return String(Math.round(n));
  }
}

/** One decimal at most, for figures that are not counts (percentage points). */
export function formatDecimal(n: number): string {
  try {
    return formatter('decimal').format(n);
  } catch {
    return String(Math.round(n * 10) / 10);
  }
}

/**
 * A rate the API already expresses IN PERCENT (71.3 means 71.3 %), so it is
 * divided back down for Intl's percent style — which is what puts the sign on
 * the right side of the number for each language.
 */
export function formatPercent(value: number): string {
  try {
    return formatter('percent').format(value / 100);
  } catch {
    return `${value}%`;
  }
}

/**
 * "2m 25s" — how long a visit lasted. Hours only past sixty minutes: a tab
 * left open all afternoon is one visit, and "238m" reads as a typo.
 */
export function formatDuration(ms: number, t: TFunction): string {
  const totalSeconds = ms > 0 ? Math.round(ms / 1000) : 0;
  if (totalSeconds < 60) return t('formAnalytics.duration.seconds', { s: totalSeconds });

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) {
    return t('formAnalytics.duration.minutes', { m: minutes, s: totalSeconds % 60 });
  }

  return t('formAnalytics.duration.hours', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export type Delta = { direction: 'up' | 'down' | 'flat'; label: string };

/**
 * A count against the same count for the window before. A headline number
 * alone can't be read — 83 visitors is good or bad depending on last month.
 *
 * Nothing to compare against says "new" rather than "+∞ %".
 */
export function countDelta(now: number, previous: number | undefined, t: TFunction): Delta | null {
  if (previous === undefined) return null;
  if (previous === 0) {
    return now > 0 ? { direction: 'up', label: t('formAnalytics.delta.new') } : null;
  }

  const pct = Math.round(((now - previous) / previous) * 100);
  if (pct === 0) return { direction: 'flat', label: formatPercent(0) };

  return {
    direction: pct > 0 ? 'up' : 'down',
    label: `${pct > 0 ? '+' : '−'}${formatPercent(Math.abs(pct))}`,
  };
}

/**
 * A rate against the rate before, in percentage POINTS: 5 % → 6 % is +1 point,
 * not +20 %. Saying it as a relative change would make a small funnel's rate
 * look like it doubled every other week.
 */
export function pointDelta(now: number, previous: number | undefined, t: TFunction): Delta | null {
  if (previous === undefined) return null;

  const diff = Math.round((now - previous) * 10) / 10;
  if (diff === 0) {
    return { direction: 'flat', label: t('formAnalytics.delta.points', { n: formatDecimal(0) }) };
  }

  return {
    direction: diff > 0 ? 'up' : 'down',
    label: `${diff > 0 ? '+' : '−'}${t('formAnalytics.delta.points', {
      n: formatDecimal(Math.abs(diff)),
    })}`,
  };
}

/**
 * What a visit is at `now`, rather than when the list was fetched.
 *
 * "Filling in now" is only true inside the window the server judged it in. A
 * list kept on screen for ten minutes would otherwise go on calling someone
 * present long after they left — so a present state lapses on the clock into
 * the verdict the server would give the same visit today: started means
 * abandoned, not started means bounced.
 */
export function decayStatus(
  visit: Pick<Visit, 'status' | 'lastSeenAt' | 'liveWindowSeconds'>,
  now: number
): VisitStatus {
  if (visit.status !== 'active' && visit.status !== 'looking') return visit.status;

  const seen = visit.lastSeenAt ? new Date(visit.lastSeenAt).getTime() : Number.NaN;
  if (Number.isFinite(seen) && now - seen <= visit.liveWindowSeconds * 1000) return visit.status;

  return visit.status === 'active' ? 'abandoned' : 'bounced';
}
