import { currentIntlLocale } from '@/lib/i18n';

/**
 * Calendar arithmetic, in the phone's local time.
 *
 * A deliberate simplification worth naming: the API buckets by the PORTAL's
 * timezone (Europe/Amsterdam) and the grid buckets by the device's. For anyone
 * in the Netherlands those are the same clock, which is everyone this app is
 * for. A dealer answering mail from another continent would see a late-evening
 * visit sit on the adjacent day — visibly odd rather than quietly wrong, and
 * the fix (a real timezone library) is not worth 300 KB of bundle for a case
 * that has not happened.
 */

/** Y-m-d for a Date, in local time — never toISOString, which is UTC. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** The Y-m-d an ISO timestamp falls on locally. */
export function dayOf(iso: string): string {
  return dateKey(new Date(iso));
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);

  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * The six-week grid a month is drawn on, Monday first.
 *
 * Always six rows, even when five would do. A grid that changes height as you
 * page through the year makes the agenda underneath jump, and the eye loses
 * its place — every native calendar pads for the same reason.
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = startOfMonth(year, month);
  // getDay() is Sunday-first; Europe reads Monday-first.
  const leading = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - leading);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Weekday initials, Monday first, in the reader's language. */
export function weekdayInitials(): string[] {
  const locale = currentIntlLocale();
  // 2024-01-01 was a Monday; any Monday would do.
  const monday = new Date(2024, 0, 1);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString(locale, { weekday: 'narrow' });
  });
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(currentIntlLocale(), {
    month: 'long',
    year: 'numeric',
  });
}

export function isToday(date: Date): boolean {
  return dateKey(date) === dateKey(new Date());
}

/** Minutes past midnight, for ordering a day's items. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);

  return d.getHours() * 60 + d.getMinutes();
}
