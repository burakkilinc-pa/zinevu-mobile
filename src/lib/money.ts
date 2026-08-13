import { currentIntlLocale } from '@/lib/i18n';

/**
 * Money on this backend is a decimal amount in EUROS, not integer cents
 * (`deals.total` is cast to float, the dashboard rounds to two places). So
 * everything here takes euros — passing cents would render a thousand times too
 * much, which is the kind of bug that reaches a customer.
 */

/** The tenant's currency. EUR everywhere today; parameterised, not assumed. */
const DEFAULT_CURRENCY = 'EUR';

/**
 * Formats an amount for display, in the language the user is reading — a Dutch
 * portal writes "€ 1.234,50" and a French one "1 234,50 €", and the number is
 * the same number.
 */
export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(currentIntlLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // A locale Intl can't load must not take a lead card down with it.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Formats an amount with no decimals — for list and tile figures, where the
 * cents are noise. Rounds rather than truncates, so a total never reads lower
 * than it is.
 */
export function formatMoneyShort(amount: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(currentIntlLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/**
 * Parses a typed amount, accepting both a comma and a dot as the decimal mark
 * (a Dutch keyboard produces the comma). Returns null when it isn't a number.
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');

  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;

  const value = Number(cleaned);

  return Number.isFinite(value) ? value : null;
}
