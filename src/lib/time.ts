import { t, currentIntlLocale } from '@/lib/i18n';

/** Compact relative time for chat lists ("3m", "2h", "Yesterday"). */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('time.now');
  if (min < 60) return t('time.minutesShort', { n: min });
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return t('time.hoursShort', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days === 1) return t('time.yesterday');
  if (days < 7) return t('time.daysShort', { n: days });
  return new Date(iso).toLocaleDateString(currentIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
  });
}

/** WhatsApp-style "last seen" label ("today 14:05", "yesterday 09:12"). */
export function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = clockTime(iso);
  if (d.toDateString() === now.toDateString())
    return `${t('time.todayLower')} ${time}`;
  if (d.toDateString() === yesterday.toDateString())
    return `${t('time.yesterdayLower')} ${time}`;
  return `${d.toLocaleDateString(currentIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
  })} ${time}`;
}

/** True when two ISO timestamps fall on the same local calendar day. */
export function sameLocalDay(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toDateString() === db.toDateString();
}

/** Day-separator label ("Today", "Yesterday", "12 June 2026"). */
export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t('time.today');
  if (d.toDateString() === yesterday.toDateString()) return t('time.yesterday');
  return d.toLocaleDateString(currentIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Full date ("12 June 2026"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(currentIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Full date + time ("12 June, 14:00"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(currentIntlLocale(), {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Clock time for message bubbles ("14:05"). */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(currentIntlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}
